# Web Push Notifications — TechBild Delivery

Guia completo para configurar, fazer deploy e validar o módulo de push notifications.

---

## Como funciona

```
[Novo pedido / mudança de status]
        │
        ▼
Trigger SQL: send_order_push_event()
        │  lê push_function_token de app_private_settings
        │
        ▼
pg_net: POST https://<project>.functions.supabase.co/send-push
        │  Authorization: Bearer <PUSH_FUNCTION_TOKEN>
        │
        ▼
Edge Function: send-push/index.ts
        │  valida token → consulta push_subscriptions
        │  filtra por recipientUserIds ou recipientRoles
        │
        ▼
Web Push API (VAPID) → navegador/PWA do destinatário
        │
        ▼
Service Worker: sw.js → exibe a notificação
```

---

## Pré-requisitos

- Supabase CLI instalado (`npm install -g supabase`)
- Projeto linkado: `supabase link --project-ref <seu-project-ref>`
- Extensão `pg_net` ativa no banco (incluída na migration)

---

## 1. Gerar as chaves VAPID

```bash
npx web-push generate-vapid-keys
```

Saída esperada:
```
Public Key:  Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=
Private Key: yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy=
```

Guarde esses valores. A chave pública vai para o `.env` do frontend; a privada vai apenas para os Secrets da Edge Function.

---

## 2. Configurar os Secrets da Edge Function

Execute no terminal (projeto linkado):

```bash
supabase secrets set PUSH_FUNCTION_TOKEN="GERE_UM_TOKEN_FORTE_AQUI"
supabase secrets set VAPID_PUBLIC_KEY="SUA_VAPID_PUBLIC_KEY"
supabase secrets set VAPID_PRIVATE_KEY="SUA_VAPID_PRIVATE_KEY"
supabase secrets set VAPID_SUBJECT="mailto:seu-email@dominio.com"
```

> **PUSH_FUNCTION_TOKEN**: use qualquer string aleatória forte.
> Exemplo de geração: `openssl rand -hex 32`

Confirme os secrets cadastrados:

```bash
supabase secrets list
```

---

## 3. Fazer deploy da Edge Function

```bash
supabase functions deploy send-push --no-verify-jwt
```

> `--no-verify-jwt` é necessário porque o token de autenticação da função
> é o `PUSH_FUNCTION_TOKEN` (Bearer customizado), não o JWT do Supabase.

Anote a URL retornada:
```
https://hlizwtgorckdktzucwgj.functions.supabase.co/send-push
```

---

## 4. Atualizar o banco com a URL e o token

Execute no **SQL Editor do Supabase** (ou via `supabase db push`):

```sql
UPDATE public.app_private_settings
SET
  push_function_url   = 'https://hlizwtgorckdktzucwgj.functions.supabase.co/send-push',
  push_function_token = 'O_MESMO_VALOR_DE_PUSH_FUNCTION_TOKEN'
WHERE singleton = true;
```

> O `push_function_token` aqui deve ser **exatamente o mesmo valor** definido
> no Secret `PUSH_FUNCTION_TOKEN` no passo 2.

---

## 5. Configurar a chave VAPID pública no frontend

No arquivo `.env` (ou `.env.local`) do projeto frontend:

```env
VITE_VAPID_PUBLIC_KEY="SUA_VAPID_PUBLIC_KEY"
```

Depois recompile e faça redeploy:

```bash
npm run build
npm run deploy
```

---

## 6. Executar a migration do banco

Se ainda não rodou o SQL de criação das tabelas e funções:

```bash
supabase db push
```

Ou rode manualmente o arquivo `supabase/migrations/20240006_push_notifications.sql`
no SQL Editor do Supabase.

---

## 7. Validar a configuração

### 7.1 — Verificar status do token no banco

```sql
SELECT
  push_function_url,
  CASE
    WHEN push_function_token IS NULL OR trim(push_function_token) = ''
      THEN 'TOKEN_NAO_CONFIGURADO'
    WHEN push_function_token = 'COLE_AQUI_O_PUSH_FUNCTION_TOKEN'
      THEN 'TROQUE_O_PLACEHOLDER'
    ELSE 'TOKEN_CONFIGURADO'
  END AS push_function_token_status
FROM public.app_private_settings
WHERE singleton = true;
```

**Resultado esperado:**

| push_function_url | push_function_token_status |
|---|---|
| https://hlizwtgorckdktzucwgj.functions.supabase.co/send-push | TOKEN_CONFIGURADO |

### 7.2 — Testar a Edge Function diretamente

```bash
curl -X POST \
  https://hlizwtgorckdktzucwgj.functions.supabase.co/send-push \
  -H "Authorization: Bearer SEU_PUSH_FUNCTION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientUserIds": [],
    "recipientRoles": ["admin"],
    "notification": {
      "title": "Teste de push",
      "body": "Notificação de teste.",
      "url": "/",
      "icon": "/Delivery-192.png",
      "badge": "/Delivery-192.png",
      "orderId": "00000000-0000-0000-0000-000000000000",
      "orderCode": "#0000",
      "status": "teste"
    }
  }'
```

**Resposta esperada (sucesso):**
```json
{ "sent": 1, "failed": 0, "disabled": 0 }
```

**Resposta se nenhum dispositivo inscrito:**
```json
{ "sent": 0, "failed": 0, "disabled": 0, "message": "NO_ACTIVE_SUBSCRIPTIONS" }
```

### 7.3 — Verificar subscriptions salvas

```sql
SELECT id, user_id, user_role, is_active, created_at
FROM public.push_subscriptions
ORDER BY created_at DESC
LIMIT 10;
```

---

## 8. Usando no frontend

```typescript
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushSubscribed,
  getOrderNotifications,
  markNotificationsRead,
} from './utils/webPush';

// Ativar notificações (chamar de um evento de clique do usuário)
const ok = await subscribeToPushNotifications('cliente');

// Verificar se já está inscrito
const subscribed = await isPushSubscribed();

// Carregar histórico de notificações
const notifications = await getOrderNotifications(20, 0);

// Marcar como lidas
await markNotificationsRead(notifications.map(n => n.id));

// Cancelar inscrição
await unsubscribeFromPushNotifications();
```

---

## Variáveis de ambiente — resumo

### Frontend (`.env`)

| Variável | Visibilidade | Descrição |
|---|---|---|
| `VITE_VAPID_PUBLIC_KEY` | Pública (seguro) | Chave VAPID pública para criar subscriptions |

### Edge Function Secrets (nunca no repositório)

| Secret | Descrição |
|---|---|
| `PUSH_FUNCTION_TOKEN` | Token Bearer compartilhado entre banco e função |
| `VAPID_PUBLIC_KEY` | Mesma chave pública do VAPID |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID — **nunca expor** |
| `VAPID_SUBJECT` | `mailto:seu-email@dominio.com` ou URL do site |
| `SUPABASE_URL` | Injetado automaticamente pelo Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Injetado automaticamente pelo Supabase |

---

## Segurança

- O `PUSH_FUNCTION_TOKEN` **nunca** deve aparecer no código-fonte ou em variáveis `VITE_*`.
- A tabela `app_private_settings` não tem política de leitura pública — acesso somente via funções `SECURITY DEFINER` e pelo service role.
- Subscriptions inválidas (HTTP 404/410 do serviço push) são desativadas automaticamente pela Edge Function.
- O trigger SQL usa `EXCEPTION WHEN OTHERS THEN RETURN NEW` para garantir que uma falha no push **nunca bloqueie** a criação ou atualização de um pedido.

---

## Resolução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| `TOKEN_CONFIGURADO` no SQL mas push não chega | Mismatch entre o banco e o Secret | Confirme que o valor em `app_private_settings` é **idêntico** ao Secret `PUSH_FUNCTION_TOKEN` |
| Edge Function retorna `VAPID_NOT_CONFIGURED` | Secrets VAPID ausentes | `supabase secrets set VAPID_PUBLIC_KEY=...` |
| `UNAUTHORIZED` na Edge Function | Token incorreto no header | Verifique o valor em `app_private_settings.push_function_token` |
| Push chega mas o clique não abre a página certa | `url` no payload errada | Ajuste `v_target_url` na função `send_order_push_event()` |
| Sem subscriptions na tabela | Frontend não chamou `subscribeToPushNotifications` | Certifique-se de chamar a função de um gesto do usuário (clique) |
