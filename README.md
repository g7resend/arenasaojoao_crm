# Arena São João — Sistema de gestão

Painel web (mobile-first) para a gestão da quadra de futevôlei: alunos e mensalidades, aulas avulsas, aluguel da quadra, eventos com lista de pagantes e mensagem semanal de horários para o grupo.

**Stack:** React + Vite + TypeScript + Tailwind CSS · Supabase (banco + login) · GitHub Pages.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha com a URL e a anon key do Supabase
npm run dev            # http://localhost:5173
```

## Configuração

### 1. Banco de dados (Supabase)
1. No painel do Supabase, abra **SQL Editor → New query**.
2. Cole todo o conteúdo de `supabase/migrations/001_init.sql` e clique em **Run**. Depois, numa nova query, faça o mesmo com `supabase/migrations/002_event_images.sql` (imagens dos eventos).
3. Em **Authentication → Users → Add user → Create new user**, crie o login do administrador (marque **Auto Confirm User**).
4. Em **Authentication → Sign In / Providers**, **desative “Allow new users to sign up”**. Sem isso, qualquer pessoa poderia criar uma conta e ler os dados.

Todas as tabelas têm RLS ativado: só usuários logados leem/gravam, e a anon key sozinha não acessa nada.

### 2. GitHub
1. Crie um repositório (pode ser privado se sua conta tiver GitHub Pages para repositórios privados; senão, público. O código não contém segredos).
2. Envie o código:
   ```bash
   git init
   git add .
   git commit -m "Sistema Arena São João"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
   git push -u origin main
   ```
3. Em **Settings → Secrets and variables → Actions → New repository secret**, crie:
   - `VITE_SUPABASE_URL` = URL do projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon key do projeto
4. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
5. Em **Actions**, rode o workflow **Deploy no GitHub Pages** (ou faça um novo push na `main`). O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Opcional: no Supabase, em **Authentication → URL Configuration**, coloque o endereço do GitHub Pages em **Site URL**.

## Estrutura

```
supabase/migrations/001_init.sql   schema, view, função de mensalidades e RLS
src/lib/        cliente Supabase, formatação (R$, datas, telefone), WhatsApp, exportação
src/hooks/      autenticação, configurações, toasts
src/components/ UI base, layout e componentes de cada módulo
src/pages/      telas (Dashboard, Alunos, Mensalidades, Aulas, Quadra, Eventos, Horários, Configurações)
```

## Notas
- Telefones são salvos só com números e DDI 55 (ex.: `5532999999999`).
- O status “atrasado” é calculado pela view `payments_view` com a data de hoje em São Paulo.
- “Gerar mensalidades do mês” usa a função `generate_monthly_payments` e não duplica cobranças; alunos sem plano ficam de fora.
- Reservas da quadra com horário sobreposto são bloqueadas pelo banco (constraint de exclusão).
