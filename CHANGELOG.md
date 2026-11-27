# Changelog

## 0.3.0

- Demo pública isolada no navegador, com cenários sintéticos e limpeza local.
- Navegação com React Router, dados operacionais com TanStack Query e gráficos Recharts.
- Upload privado multipart, prévia paginada e confirmação idempotente.
- Consulta com filtros por loja, motivo, status e datas distintas de inclusão e recebimento. CSV com proteção contra fórmulas em campos de texto.
- Login por credencial individual e controles por perfil. Exibição de prazo quando configurado na API.
- Lockfile, Vitest, React Testing Library, Playwright, axe e verificação HTTP do deploy.
- Pendências de aceite incluem validação na infraestrutura operacional autorizada e processamento histórico em fila.

## 0.3.1

- Login Firebase com Google, e-mail/senha e recuperação de senha.
- Sessão por aba, renovação automática, cache descartado ao sair ou trocar de conta.
- Área administrativa de usuários autorizada pelo backend.
- Build e CSP de homologação separados da demonstração pública.
- Recuperação de sessão após falha de rede, limitação e inicialização a frio, com testes em desktop e mobile.

- Tela de acesso da homologação redesenhada, com cadastro por e-mail, confirmação de senha e liberação administrativa por UID.
- Cadastro agora diferencia e-mail já cadastrado e senha rejeitada e oferece recuperação direta.

## Em desenvolvimento

- Abertura e edição nativas, XLSX filtrado, lojas e aprovação de contas.
- Histórico de alterações, catálogo de referência e busca por PLU.
- Importação comparativa, mapeamento XLSX, detalhe avulso por loja e proteção contra prévia desatualizada.
- Indicadores de prazo opt-in e preservação do build demo isolado.

## Em desenvolvimento: conferências e configuração

- Fornecedores conferidos: registro, filtros, correção, cancelamento, histórico e XLSX.
- Configuração de prazo, feriados, conversões validadas e valores financeiros conferidos.
- Diagnóstico administrativo de servidor e cobertura de valores financeiros no painel.
