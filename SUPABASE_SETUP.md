# Configurar login e sincronização na nuvem (Supabase)

O aplicativo continua funcionando localmente sem estas configurações. Para habilitar login e sincronização entre dispositivos, configure um projeto Supabase.

## 1. Criar o projeto

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings → API**, copie a **Project URL** e a **publishable/anon key** do projeto.
3. No ambiente de variáveis do Lovable, configure:
   - `VITE_SUPABASE_URL` = URL do projeto
   - `VITE_SUPABASE_ANON_KEY` = chave pública/anon do projeto

Nunca coloque uma `service_role` key no frontend.

## 2. Criar a tabela segura

No Supabase, abra **SQL Editor**, crie uma consulta e execute:

```sql
create table if not exists public.finance_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_snapshots enable row level security;

grant select, insert, update, delete
on public.finance_snapshots to authenticated;

create policy "Users can read their own finance snapshot"
on public.finance_snapshots
for select to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own finance snapshot"
on public.finance_snapshots
for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own finance snapshot"
on public.finance_snapshots
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own finance snapshot"
on public.finance_snapshots
for delete to authenticated
using (auth.uid() = user_id);
```

## 3. Configurar autenticação

Em **Authentication → Providers**:

- Habilite **Email** se quiser manter o login por e-mail e senha.
- Habilite **Google** para mostrar o botão “Continuar com Google”. Será necessário criar credenciais OAuth no Google Cloud Console (ID do cliente e segredo) e inseri-las nas configurações do provedor Google no Supabase.
- No Google Cloud Console, configure como URI de redirecionamento autorizada a URL de callback do Supabase mostrada na configuração do provedor, normalmente `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
- Em **Authentication → URL Configuration**, adicione a URL publicada do aplicativo à lista de URLs permitidas. Se usar domínio próprio, adicione também `https://minhagestaopessoal.com` depois de conectar o domínio.
- Para cadastro por e-mail com confirmação, configure também o envio de e-mail; a pessoa precisará confirmar o endereço conforme as configurações do projeto.

## 4. Como usar no aplicativo

1. Atualize/abra o app no Lovable depois de adicionar as variáveis de ambiente.
2. Em **Backup e relatórios**, crie uma conta ou entre.
3. No primeiro dispositivo, use **Sincronizar / recuperar** para enviar os dados locais se ainda não existir cópia na nuvem.
4. Em outro dispositivo, entre com a mesma conta e use **Sincronizar / recuperar** para carregar a cópia.
5. Depois de editar os dados, clique em **Enviar alterações atuais** para salvar a versão atual na nuvem.

**Importante:** a primeira sincronização decide se recupera a cópia já existente ou envia os dados locais quando ainda não há cópia. Antes de recuperar dados em um dispositivo que já tenha registros diferentes, baixe um backup. O aplicativo salva uma cópia completa; evite editar simultaneamente em vários dispositivos, pois versões concorrentes podem se sobrescrever.
