# Desafio Moveo – Sheets + Calendar Webhooks (Next.js)

- Integração do chatbot Moveo com Google Sheets e Google Calendar, via Next.js

# Funcionalidades:

- /api/sheets_by_phone → busca o usuário na planilha pelo telefone e retorna os dados da planilha.

- /api/editor → edita nome ou email na planilha (precisa do phone no contexto) ou cria evento no Calendar.

- /api/calendar_by_email →  busca a agenda do usuário e retorna.

# 1) Requisitos

- Node.js
- Conta Google Cloud (para Service Account)
- Conta ngrok

# 2) Criar arquivo ".env.local"

Formatação do arquivo:

Google Sheets
SPREADSHEET_ID=1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHEET_NAME=Users

Service Account
GOOGLE_CLIENT_EMAIL=moveo-bot@seu-projeto.iam.gserviceaccount.com
Colar a chave privada inteira, com \n nas quebras se necessário
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...==\n-----END PRIVATE KEY-----\n"

Google Calendar (ID do calendário compartilhado com a SA)
CALENDAR_ID_DEFAULT=xxxxxxxxxxxxxxxxxxxxxxxx@group.calendar.google.com

(Opcional) token de verificação de webhook
WEBHOOK_TOKEN=XXXXXXXXXXXXXXXXX

# 3) Permissões no Google

3.1 Crie uma Service Account no Google Cloud.

3.2 Gere uma Key (JSON) e copie os campos ao .env.local.

3.3 Compartilhe:
3.3.1 Planilha com o e-mail da SA como “Editor”.
3.3.2 Calendário com a SA como “Make changes and manage sharing”.

# 4) Estrutura da planilha

A planilha no google sheets deve seguir essa estrutura:

phone | name | email

# 5) Rodando Código

5.1 Next.js

npm run dev

app em http://localhost:3000

5.2 Ngrok

ngrok http 3000

# 6) Configurações na MOVEO

Alterar domínios do ngrok em todos os webhooks

https://<seu-subdominio>.ngrok-free.app/api/sheets_by_phone
https://<seu-subdominio>.ngrok-free.app/api/calendar_by_email
https://<seu-subdominio>.ngrok-free.app/api/editor

# 7) Estrutura do Projeto 

src/
  app/
    api/
      sheets_by_phone/route.ts     # webhook Sheets
      editor/route.ts              # webhook Editor (sheets+calendar)
  lib/
    googlesheets.ts                # findUserByPhone
    Nlpschedule.ts                 # parsing simples de data/hora (evento)
    markdown.ts                    # sheetUserToMarkdown (perfil)

