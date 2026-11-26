# RM Control | Frontend

Painel proprietário de ocorrências logísticas, importação, indicadores financeiros e conferência de inventário.

## Demonstração pública

[RM Control na Vercel](https://rm-control-frontend.vercel.app) é o domínio estável. O build público usa cenários sintéticos de listagem, detalhamento e histórico. O navegador guarda somente os identificadores dos cenários selecionados. A ação **Limpar demonstração** apaga o progresso e o armazenamento usado pela versão anterior. A demo usa uma política de conteúdo que bloqueia conexões da página e a saúde em `/api/health` é um arquivo estático. URLs geradas de preview permanecem protegidas pela Vercel.

## Desenvolvimento

Node.js 22.17 ou superior. O ambiente de CI usa Node 22.22.

```bash
npm ci
npm run dev
npm run build:demo
npm test
npx playwright install chromium
npm run test:e2e
```

O modo de desenvolvimento abre em http://127.0.0.1:5173. Os testes Playwright executam o build público em desktop e mobile, incluindo acessibilidade automatizada e um contexto anônimo separado.

## Ambiente operacional

Em um host privado, configure `VITE_APP_MODE=operational` e `VITE_API_URL`, execute `npm run build` e configure o fallback do servidor para as rotas React. Use o [backend](https://github.com/pethersonzada/rm-control-backend) e conceda credenciais individuais com o perfil e a lista de lojas autorizados. A credencial dura apenas a sessão desta aba. Evite usar a configuração pública da Vercel para servir este build.

O XLSX vai por multipart à API privada, que executa a leitura. A interface mostra o estado de processamento e permite cancelar a espera pela prévia. A prévia usa páginas de 50 chamados. O limite por arquivo é 21 MB e o lote de gravação tem limite de 12 MB JSON. O transporte direto preserva o arquivo e evita expansão em base64. Web Workers foram avaliados para leitura local. Eles ajudariam em uma futura prévia privada offline. O parser Python é a única implementação de regras XLSX neste fluxo.

A interface usa React Router, TanStack Query, Recharts carregado sob demanda e CSS responsivo. O CSS existente foi substituído por regras pequenas para as telas atuais. Tailwind CSS e shadcn/ui foram avaliados. O projeto mantém a estilização em CSS para limitar dependências e cobrir os componentes que usa.

Expanda um chamado para editar motivo e status na prévia. Corrija conflitos estruturais na origem. O relatório exporta até 10 mil chamados filtrados. A consulta e a exportação usam a ordenação por código selecionada. Os valores são agregados em decimal no backend e formatados com BigInt no navegador. Leia o [CHANGELOG](CHANGELOG.md) para detalhes e pendências.

## Verificação de deploy

Após concluir o fluxo de CI, valide o domínio sem sessão da Vercel.

```bash
node scripts/smoke.mjs
RM_TEST_URL=https://rm-control-frontend.vercel.app npm run test:e2e
```

Software proprietário. Consulte [LICENSE](LICENSE).
