# MentorEdu — Guía Frontend: Integración del Asistente de IA

**Proyecto:** mentoredu-frontend  
**Stack:** Angular 19 · Signals · Standalone Components  
**Rama:** `feature/ai-assistant`

Esta guía explica cómo se integra el módulo de IA en el frontend: cómo la pantalla "Asistente IA" consume los endpoints de Tool Calling y RAG, y cómo el panel de reporte aparece en el detalle de un recurso.

---

## Antes de empezar (requisitos)

- Proyecto Angular con componentes standalone y zoneless change detection.
- `HttpClient` habilitado con interceptores funcionales en `app.config.ts`.
- Login funcionando y `AuthStateService` con el token y rol del usuario.
- Backend corriendo con `OPENAI_API_KEY` configurada y pgvector levantado.

---

## Paso 1. URL del API de IA

Los endpoints de IA viven bajo `/api/v1/ai/`, que ya está cubierto por el `apiUrl` existente. **No se necesita una variable de entorno separada.**

```typescript
// src/environments/environment.ts (producción — sin cambios)
export const environment = {
  production: true,
  apiUrl: 'https://mentoredu-api.onrender.com/api/v1',
  baseUrl: 'https://mentoredu-api.onrender.com',
};
```

El servicio de IA construye la base así:

```typescript
private readonly base = `${environment.apiUrl}/ai`;
// Resultado: https://mentoredu-api.onrender.com/api/v1/ai
```

---

## Paso 2. Modelos

Crea `src/app/models/ai.model.ts`:

```typescript
export type AiMode = 'assistant' | 'support';

export interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
}

export interface IngestResult {
  chunksIngested: number;
}

export interface ReportInsight {
  resumen: string;
  recomendacion: string;
}

export interface ReportResponse {
  insight: ReportInsight;
}
```

**Resumen de modelos:**
- `ChatMessage` — mensaje local del chat (usuario o bot).
- `ChatRequest / ChatResponse` — contrato con el backend para el chat.
- `IngestResult` — respuesta del endpoint de ingesta.
- `ReportInsight` — structured output del reporte (resumen + recomendación).
- `ReportResponse` — respuesta completa del endpoint de reporte.

---

## Paso 3. Servicio de IA

Crea `src/app/services/ai.service.ts`. Centraliza todas las llamadas HTTP y además mantiene el **estado de la conversación** como signals del singleton, para que el chat persista al navegar entre páginas.

```typescript
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AiMode, ChatMessage, ChatResponse, IngestResult, ReportResponse } from '../models/ai.model';

const GREETING: Record<AiMode, string> = {
  assistant: 'Hola, soy tu asistente de MentorEdu. Puedo ayudarte a encontrar recursos académicos con lenguaje natural. ¿Qué estás buscando?',
  support: 'Modo soporte: respondo preguntas sobre cómo usar MentorEdu basándome en la guía oficial.',
};

@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ai`;

  // Estado de la conversación (persiste mientras la app esté abierta)
  readonly mode = signal<AiMode>('assistant');
  readonly messages = signal<ChatMessage[]>([{ from: 'bot', text: GREETING.assistant }]);

  setMode(newMode: AiMode): void {
    if (this.mode() === newMode) return;
    this.mode.set(newMode);
    this.messages.set([{ from: 'bot', text: GREETING[newMode] }]);
  }

  pushMessage(msg: ChatMessage): void {
    this.messages.update(list => [...list, msg]);
  }

  askAssistant(message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.base}/assistant`, { message });
  }

  askSupport(message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.base}/support/ask`, { message });
  }

  ingest(): Observable<IngestResult> {
    return this.http.post<IngestResult>(`${this.base}/support/ingest`, {});
  }

  getReport(resourceId: string): Observable<ReportResponse> {
    return this.http.get<ReportResponse>(`${this.base}/report/${resourceId}`);
  }
}
```

> **Por qué el estado en el servicio:** `AiService` es un singleton (`providedIn: 'root'`). Al guardar `messages` y `mode` como signals en el servicio en lugar del componente, el chat no se reinicia cuando el usuario navega a otra página y regresa.

---

## Paso 4. Token JWT (interceptor)

El interceptor de autenticación ya estaba configurado en el proyecto y cubre todos los endpoints de `/api/v1/`, incluyendo los de IA. No se requiere ningún cambio.

```typescript
// src/app/core/interceptors/auth.interceptor.ts (ya existente)
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authState = inject(AuthStateService);
  const token = authState.accessToken();
  if (token) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
```

---

## Paso 5. Pipe de Markdown

El bot responde con formato Markdown (`**negrita**`, `[links](url)`, listas con `-`). Se crea una pipe standalone que convierte ese texto a HTML seguro.

Crea `src/app/shared/pipes/markdown.pipe.ts`:

```typescript
import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(text: string): SafeHtml {
    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
      if (line.startsWith('- ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${this.inline(line.slice(2))}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += line === '' ? '' : `<p>${this.inline(line)}</p>`;
      }
    }
    if (inList) html += '</ul>';

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private inline(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }
}
```

---

## Paso 6. Componente Asistente IA

### Paso 6.1 — Estructura de archivos

```
src/app/pages/ai/
├── ai.routes.ts
└── assistant/
    ├── assistant.ts
    ├── assistant.html
    └── assistant.css
```

### Paso 6.2 — Lógica (`assistant.ts`)

El componente delega el estado al `AiService` y solo maneja el estado de UI local (enviando, ingiriendo).

```typescript
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { AiService } from '../../../services/ai.service';
import { AiMode } from '../../../models/ai.model';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';

@Component({
  selector: 'app-assistant',
  imports: [FormsModule, MarkdownPipe],
  templateUrl: './assistant.html',
  styleUrl: './assistant.css',
})
export class Assistant {
  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  readonly aiService = inject(AiService);
  readonly authState = inject(AuthStateService);

  readonly isAdmin = this.authState.role() === 'ADMIN';
  draft = '';
  readonly sending = signal(false);
  readonly ingesting = signal(false);
  readonly ingestMsg = signal('');

  get mode() { return this.aiService.mode; }
  get messages() { return this.aiService.messages; }

  setMode(newMode: AiMode): void {
    this.aiService.setMode(newMode);
  }

  send(): void {
    const value = this.draft.trim();
    if (!value || this.sending()) return;

    this.aiService.pushMessage({ from: 'user', text: value });
    this.draft = '';
    this.sending.set(true);
    this.scrollToBottom();

    const call = this.mode() === 'assistant'
      ? this.aiService.askAssistant(value)
      : this.aiService.askSupport(value);

    call.subscribe({
      next: res => {
        this.aiService.pushMessage({ from: 'bot', text: res.reply });
        this.sending.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.aiService.pushMessage({ from: 'bot', text: 'Ocurrió un error al procesar tu solicitud. Intenta de nuevo.' });
        this.sending.set(false);
        this.scrollToBottom();
      },
    });
  }

  ingest(): void {
    if (this.ingesting()) return;
    this.ingesting.set(true);
    this.ingestMsg.set('');
    this.aiService.ingest().subscribe({
      next: res => {
        this.ingestMsg.set(`Ingesta completada: ${res.chunksIngested} fragmentos cargados.`);
        this.ingesting.set(false);
      },
      error: () => {
        this.ingestMsg.set('Error al ingestar los documentos.');
        this.ingesting.set(false);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' }), 50);
  }
}
```

### Paso 6.3 — Plantilla (`assistant.html`)

Toggle de modo, lista de mensajes con markdown renderizado, indicador de escritura y formulario de envío.

```html
<div class="ai-page">

  <div class="ai-header">
    <div class="ai-header__text">
      <h1 class="page-title">Asistente IA</h1>
      <p class="page-subtitle">
        @if (mode() === 'assistant') { Busca recursos académicos con lenguaje natural. }
        @else { Resuelve dudas sobre el uso de MentorEdu. }
      </p>
    </div>

    <div class="ai-header__actions">
      <!-- Toggle Asistente / Soporte -->
      <div class="mode-toggle" role="group" aria-label="Modo del asistente">
        <button class="mode-toggle__btn" [class.mode-toggle__btn--active]="mode() === 'assistant'"
          type="button" (click)="setMode('assistant')">Asistente</button>
        <button class="mode-toggle__btn" [class.mode-toggle__btn--active]="mode() === 'support'"
          type="button" (click)="setMode('support')">Soporte</button>
      </div>

      <!-- Botón de ingesta — solo ADMIN en modo Soporte -->
      @if (isAdmin && mode() === 'support') {
        <button class="btn-ingest" type="button" [disabled]="ingesting()" (click)="ingest()">
          @if (ingesting()) { Ingiriendo… } @else { Cargar documentos }
        </button>
      }
    </div>
  </div>

  @if (ingestMsg()) {
    <div class="ingest-banner">{{ ingestMsg() }}</div>
  }

  <div class="chat-window">
    <div class="chat-messages">
      @for (msg of messages(); track $index) {
        <div class="chat-msg" [class.chat-msg--user]="msg.from === 'user'">
          @if (msg.from === 'bot') { <span class="chat-msg__avatar" aria-hidden="true">🤖</span> }
          <!-- Mensajes del bot: renderiza Markdown. Mensajes del usuario: texto plano. -->
          @if (msg.from === 'bot') {
            <span class="chat-msg__bubble chat-msg__bubble--md" [innerHTML]="msg.text | markdown"></span>
          } @else {
            <span class="chat-msg__bubble">{{ msg.text }}</span>
          }
        </div>
      }

      <!-- Indicador de escritura -->
      @if (sending()) {
        <div class="chat-msg">
          <span class="chat-msg__bubble chat-msg__bubble--typing">
            <span></span><span></span><span></span>
          </span>
        </div>
      }

      <div #messagesEnd></div>
    </div>

    <!-- Formulario — Enter envía, Shift+Enter nueva línea -->
    <form class="chat-form" (ngSubmit)="send()">
      <textarea class="chat-form__input" [(ngModel)]="draft" name="draft" rows="1"
        [disabled]="sending()" (keydown)="onKeydown($event)" aria-label="Mensaje"
        placeholder="{{ mode() === 'assistant' ? 'Ej: busca recursos de cálculo…' : 'Ej: ¿cómo subo una resolución?' }}">
      </textarea>
      <button class="chat-form__send" type="submit" [disabled]="sending() || !draft.trim()" aria-label="Enviar">
        ➤
      </button>
    </form>
  </div>

</div>
```

### Paso 6.4 — Rutas (`ai.routes.ts`)

```typescript
import { Routes } from '@angular/router';

export const AI_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./assistant/assistant').then(m => m.Assistant),
  },
];
```

---

## Paso 7. Registrar la ruta

En `src/app/app.routes.ts`, dentro del bloque protegido por `authGuard`:

```typescript
{ path: 'ai', loadChildren: () => import('./pages/ai/ai.routes').then(m => m.AI_ROUTES) },
```

---

## Paso 8. Agregar el enlace de navegación

En `src/app/layouts/main-layout/main-layout.html`, el link se agrega en tres lugares:

```html
<!-- Sidebar (desktop) -->
<a routerLink="/ai" routerLinkActive="sidebar__link--active" class="sidebar__link">
  Asistente IA
</a>

<!-- Menú móvil -->
<a routerLink="/ai" routerLinkActive="mobile-nav__link--active" class="mobile-nav__link" (click)="closeSidebar()">
  Asistente IA
</a>

<!-- Topbar (links rápidos) -->
<a routerLink="/ai" routerLinkActive="topbar__link--active" class="topbar__link">Asistente IA</a>
```

---

## Paso 9. Panel de reporte en `resource-detail`

El reporte de análisis de resoluciones se muestra en el sidebar del detalle de recurso, visible solo para el autor del recurso, reviewer asociado o ADMIN — y únicamente si el recurso acepta resoluciones.

### En `resource-detail.ts` — agregar estado y método:

```typescript
// Importar
import { AiService } from '../../../services/ai.service';
import { ReportInsight } from '../../../models/ai.model';

// Inyectar
private aiService = inject(AiService);

// Signals
readonly isLoadingReport = signal(false);
readonly report = signal<ReportInsight | null>(null);
readonly reportError = signal('');

// Control de visibilidad
canSeeReport(): boolean {
  const role = this.authState.role();
  const r = this.resource();
  if (!r || !r.aceptaResoluciones) return false;
  return role === 'ADMIN'
    || r.authorId === this.authState.user()?.id
    || this.isAssociatedReviewer();
}

// Llamada al backend
generateReport(): void {
  const r = this.resource();
  if (!r || this.isLoadingReport()) return;
  this.isLoadingReport.set(true);
  this.report.set(null);
  this.reportError.set('');

  this.aiService.getReport(r.id).subscribe({
    next: res => { this.report.set(res.insight); this.isLoadingReport.set(false); },
    error: () => {
      this.reportError.set('No se pudo generar el análisis. Intenta de nuevo.');
      this.isLoadingReport.set(false);
    },
  });
}
```

### En `resource-detail.html` — sección al final del sidebar:

```html
@if (canSeeReport()) {
  <div class="divider"></div>
  <div class="ai-report">
    <div class="ai-report__header">Análisis IA de resoluciones</div>

    @if (!report() && !isLoadingReport() && !reportError()) {
      <button class="btn-ai-report" type="button" (click)="generateReport()">
        Generar análisis
      </button>
    }

    @if (isLoadingReport()) {
      <div class="ai-report__loading">
        <app-loading-spinner size="sm" /> Analizando resoluciones…
      </div>
    }

    @if (reportError()) {
      <p class="ai-report__error">{{ reportError() }}</p>
      <button class="btn-ai-report" type="button" (click)="generateReport()">Reintentar</button>
    }

    @if (report(); as insight) {
      <div class="ai-report__result">
        <div class="ai-report__block">
          <p class="ai-report__label">Resumen</p>
          <p class="ai-report__text">{{ insight.resumen }}</p>
        </div>
        <div class="ai-report__block">
          <p class="ai-report__label">Recomendación</p>
          <p class="ai-report__text">{{ insight.recomendacion }}</p>
        </div>
        <button class="btn-ai-report btn-ai-report--secondary" type="button" (click)="generateReport()">
          Regenerar
        </button>
      </div>
    }
  </div>
}
```

---

## Paso 10. Probar

1. Backend corriendo con `OPENAI_API_KEY` y la BD pgvector levantada (`docker compose up -d`).
2. Frontend: `npm start`, navegar a `/ai`.
3. **Modo Asistente:** escribe `"busca exámenes de cálculo de la UNI"`. La IA llama a la herramienta y devuelve recursos reales de la BD.
4. **Modo Soporte:** como ADMIN, pulsa "Cargar documentos" una vez; luego pregunta `"¿cómo subo una resolución?"`.
5. **Reporte:** entra al detalle de un recurso que acepte resoluciones y tenga envíos. Si eres autor o reviewer, verás el botón "Generar análisis" al final del sidebar.
6. Navega a otra página y regresa a `/ai` — el historial del chat debe conservarse.

---

## Notas y recomendaciones

| Tema | Detalle |
|------|---------|
| **Contexto por sesión** | El historial del chat vive en `AiService` (singleton). Se pierde al recargar la página — es comportamiento esperado. |
| **Ingestar solo una vez** | Repetir la ingesta sin limpiar `vector_store` duplica fragmentos y degrada las respuestas del soporte. Para limpiar: `TRUNCATE vector_store;` en la BD. |
| **Sin historial en el backend** | Cada llamada al asistente es stateless. Si el usuario dice "dame más como ese", el modelo no recuerda la conversación anterior. |
| **Markdown renderizado** | Solo los mensajes del bot pasan por la `MarkdownPipe`. Los mensajes del usuario se muestran como texto plano para evitar XSS. |
| **Roles del reporte** | El endpoint `/api/v1/ai/report/{resourceId}` requiere rol `TEACHER` o `ACADEMY`. El frontend también lo verifica con `canSeeReport()`. |
| **CORS** | El backend debe permitir el origen del frontend (`http://localhost:4200` en dev). |
