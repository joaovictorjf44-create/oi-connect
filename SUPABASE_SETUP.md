# Login e dados na nuvem (Supabase)

O app está ligado ao projeto Supabase do usuário pelo Lovable (Settings → External Supabase). As chaves públicas são preenchidas automaticamente; nenhuma chave secreta fica no código.

## O que já está pronto

- Tabela `finance_snapshots` (um registro por pessoa) com RLS: cada usuário só lê, cria, altera e apaga os próprios dados. Visitantes sem login não têm acesso.
- Telas: `/auth` (entrar, criar conta, esqueci a senha) e `/reset-password` (criar nova senha).
- O painel (`/painel`) só abre com login. Os dados salvam automaticamente na conta.
- Na primeira vez que alguém entra num navegador que já tinha dados salvos sem login, esses dados vão para a conta dessa pessoa.

## Configurar no painel do Supabase

1. **Authentication → URL Configuration**
   - **Site URL**: `https://minha-gestao-pessoal.lovable.app`
   - **Redirect URLs**: adicione
     - `https://minha-gestao-pessoal.lovable.app/**`
     - `https://id-preview--976ea284-a40f-4dff-bc89-44bf80f95c7c.lovable.app/**`
     - (se usar domínio próprio) `https://SEU-DOMINIO/**`
2. **Authentication → Providers → Email**: deve estar ativado (já está).
3. **Confirmação de e-mail**: está ligada. Quem se cadastra precisa clicar no link do e-mail antes de entrar. O envio padrão do Supabase tem limite baixo por hora; para uso real, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.
