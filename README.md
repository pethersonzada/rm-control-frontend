# RM Control | Frontend

Painel proprietário de ocorrências logísticas, importação, indicadores financeiros e conferência de inventário.

## Demonstração pública

O build de demonstração (npm run build:demo) usa cenários sintéticos de listagem, detalhamento e histórico. O navegador guarda somente os identificadores dos cenários selecionados. A ação **Limpar demonstração** apaga o progresso e o armazenamento usado pela versão anterior. A demo usa uma política de conteúdo que bloqueia conexões da página e a saúde em `/api/health` é um arquivo estático. URLs geradas de preview permanecem protegidas pela Vercel.

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

O [endereço principal](https://rm-control-frontend.vercel.app) e o [endereço de homologação](https://rm-control-homologacao.vercel.app) são configurados para o build autenticado. Atualmente compartilham a API e o banco de testes; não representam ambientes de dados isolados. O aplicativo usa o projeto Firebase `rm-control-webapp` e a API no Render. Configure as variáveis `VITE_FIREBASE_*` e `VITE_API_URL` no projeto separado da Vercel. Defina Root Directory como `homologacao` e habilite a inclusão de fontes fora desse diretório. O build `npm run build:homologacao` publica em `homologacao/dist`. A CSP e as rotas desse projeto ficam em `homologacao/vercel.json`.

Adicione somente os dois domínios estáveis necessários aos domínios autorizados no Firebase e ao CORS do Render. A demo mantém seu próprio build e política sem rede. Configure as mesmas variáveis em `.env.local` e use `npm run dev` para desenvolvimento. A sessão Firebase dura a aba, restaura após recarregar e o SDK renova o token. O frontend carrega as permissões de `/me` e limpa os dados ao sair, trocar de conta ou perder o vínculo. O botão **Criar conta** cadastra e-mail e senha no Firebase. O usuário fica bloqueado e solicita liberação ao administrador por UID. O responsável cadastra lojas e aprova ou rejeita solicitações na interface. O primeiro administrador é provisionado pelo procedimento documentado no [backend](https://github.com/pethersonzada/rm-control-backend/blob/main/docs/firebase-homologacao.md).

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


## Fluxo principal

A área **Chamados** permite abertura e edição nativas, com produtos, notas, dados de recebimento e número externo opcional. O botão **Gerar planilha Excel** baixa um XLSX do banco com os filtros selecionados. O histórico é exibido ao expandir a ocorrência. Não há integração de abertura oficial no D-Supply. O modelo do relatório precisa de aceite do responsável.

O menu **Lojas** permite criar, editar e desativar unidades pelo administrador responsável. O menu **Usuários** gerencia os vínculos, fila de pendências e escopo. **Catálogo** cadastra referências explicitamente conferidas; o formulário do chamado permite buscar PLU para preencher campos vazios sem inferir valores ou converter embalagens.

A importação complementar apresenta comparação com os registros existentes, permite selecionar a loja do detalhe avulso, mapear cabeçalhos XLSX e cancelar/limpar a prévia. A confirmação usa a mesma chave de idempotência em tentativas de rede e pode exigir nova análise se os dados mudaram. A leitura multipart é limitada e síncrona; a barra de progresso é indeterminada, não representa percentual inventado.

Os indicadores de prazo só aparecem com calendário configurado no backend. A interface não aplica regras financeiras presumidas. Use exclusivamente dados sintéticos até a autorização corporativa.


## Fornecedores e configurações

Na área Fornecedores conferidos, registre somente conferências concluídas. O fornecedor pode aparecer mais de uma vez em entregas distintas, e o conferente pode ser diferente do usuário que registra. Os filtros por loja, período, fornecedor e conferente são aplicados também ao relatório XLSX. Correções e cancelamentos exigem motivo e preservam histórico. O formato inicial será homologado com a planilha de trabalho.

Configurações permite ao responsável cadastrar a regra de prazo, feriados e referências de conversão por embalagem de produtos ativos, sempre com fonte conferida. A conciliação preserva quantidades originais e não altera estoque. Na expansão dos chamados, a conferência financeira permite ao responsável registrar valores aprovados, recuperados e pendentes com referência, sem inferência automática. O diagnóstico é local ao processo e não mantém histórico.

Antes de utilização real, valide o modelo dos arquivos e as regras com a empresa, obtenha autorização e isole os ambientes. Ambos os endereços atuais continuam de teste; nenhum dado real deve ser inserido.

### Integração com API real no CI

O job browser-api-postgres usa PostgreSQL descartável, checkout fixado do backend e API FastAPI local. O provedor Firebase é simulado no navegador, mas os JWTs são assinados com uma chave RSA efêmera e verificados pelo backend real. A jornada cobre solicitação/aprovação de acesso, isolamento de loja, criação de chamado, persistência após reload, download XLSX, conferência de fornecedor e upload de arquivo sintético de 14–20 MB. Nenhuma conta externa, chave de serviço ou banco hospedado é usado. A validação com Google/Firebase real e domínio publicado permanece separada.
