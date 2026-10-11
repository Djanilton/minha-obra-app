# Motor de cálculo e validação

## Escopo

As cinco abas de origem têm 8.385 fórmulas: Premissas 7, Parametros Construção 32, Financiamento_SAC 5.376, Fluxo_Caixa 2.931 e Cronograma mensal 39. A leitura normaliza acentos nos nomes. O motor implementa suas regras diretamente em JavaScript; não usa eval, Excel ou valores calculados em cache para calcular projeções. O importador aceita expressões numéricas constantes como entradas, com parser aritmético restrito. Valores salvos de fórmulas são usados somente na conferência.

## Relações

| Origem | Regra no motor |
|---|---|
| Premissas B6/B8 | primeira etapa menos pago; saldo menos próximo aporte |
| Premissas B11/B13 | construção menos financiamento e FGTS; construção mais terreno |
| Premissas B23/B24/B29 | totais contratuais, percentuais e venda líquida |
| Parâmetros B/E/H/K | custo total, despesas próprias, complemento à vista, reserva inicial e taxas |
| SAC C/M | saldo anterior com arredondamento legado, amortização e aportes; saldo limitado a zero |
| SAC D/E | TR por faixas de TBF; juros sobre saldo multiplicado por (1 + TR) |
| SAC F/G/H/I/J | SAC pelo prazo restante, MIP por faixa, DFI, administração e indicador FGHAB |
| SAC K/L | FGTS bienal corrigido pela soma das últimas 12 TR; PLR quando Finan; parcela E até I |
| SAC O/T | idade e início das faixas MIP conforme a origem |
| Fluxo C/D/E | reserva anterior, CDI anual por ano, fator líquido IR e rendimento |
| Fluxo F/G/H/I | salário limitado pela reserva alvo, PLR em abril quando CDB, parcela e saldo final |
| Indicadores N/P | quitação, mínimo, saldo na quitação, juros, totais e indicadores auxiliares |
| Cronograma F/H/B/E | acumulados físicos e financeiros, totais e diferenças de fontes |

O relatório privado por célula contém as fórmulas completas. tests/validate-reference.cjs verifica cobertura e resultados de todas as fórmulas, além de entradas e totais.

## Despesas, aportes e sincronização

O quadro de despesas próprias alimenta o total de extras e a reserva inicial. Gastos cadastrados, fora de Construtora e Financiamento, também entram nesse quadro. Previsto e pago permanecem separados. Custos existentes e seus valores editados são preservados na migração. Pagamentos de construtora explicitamente registrados alimentam o pago das premissas; não se soma o histórico importado novamente.

Salários programados substituem o aporte automático nos períodos informados; extras somam ao CDB. Programas de amortização reduzem a dívida. FGTS inicial compõe as fontes e o bienal amortiza dívida; não se transforma em dinheiro disponível no CDB. Movimentos mensais existentes são somados uma vez e aparecem em colunas próprias.

A entrada de valores é gravada localmente a cada número válido. A atualização remota preserva formulários e a posição de edição. Uma alteração feita durante um envio continua pendente para o próximo envio. Metadados de parâmetros/despesas usam a data da alteração; edições simultâneas do mesmo conjunto em aparelhos diferentes ainda usam a versão mais recente, sem fusão por campo.

## Histórico da primeira referência (substituído pelas correções abaixo)

- FGTS difere entre as abas. A referência usa o valor de cada aba para conferir; o cenário integrado usa R$77.000, conforme confirmação do proprietário. Principal fica em R$339.000.
- O cronograma contém diferença entre fontes e pagamentos. Valores literais da origem não são redistribuídos sem decisão do proprietário. Mudanças do contrato/FGTS que não coincidam com o cronograma geram aviso.
- Dez fórmulas iniciais de aporte FGTS contêm #REF! em um ramo inativo. O ramo não é usado nesses meses. A regra explícita remove essa dependência no aplicativo; a planilha não é editada.
- O indicador legado de mês de quitação aponta a linha anterior. O aplicativo mostra a data em que o saldo efetivamente zera e preserva o índice legado para conferência.
- N4 é a data do menor saldo, apesar do rótulo de saldo negativo. P5 identifica o primeiro saldo negativo.
- TR altera os juros, mas não é capitalizada no saldo da origem. J (seguros/FGHAB) não entra na parcela L. Essas convenções eram preservadas na primeira versão para equivalência e não confirmam a cobrança bancária.
- H9, H12 e H13 não são usados nas fórmulas mensais da origem. CET é informativo; os juros mensais derivam da taxa anual. CDI e IR são cenários simplificados; não apuram imposto por lote.
- Despesas próprias são provisionadas no início, conforme K3/K6, em vez de debitadas novamente a cada pagamento. Movimentos manuais que repitam despesas podem duplicar saídas; não há conciliação bancária automática.

## Evidências e limites

Conferência integral realizada em 413 meses por projeção, com tolerância monetária de R$0,01. Os valores conferidos vêm do cache salvo no anexo: não houve recálculo ao vivo do Excel. O arquivo original foi preservado.

Testes automatizados cobrem invariantes SAC e reserva, mudanças de despesas e FGTS, PLR, salário, extras, movimentos manuais, amortização, quitação, entradas faltantes e diferenças de fontes. Teste em Chromium cobre digitação, preservação do formulário, leitura remota antiga, edição durante envio e paginação.

Autenticação Microsoft, download real e escrita real no OneDrive não foram exercitados nesta sessão. O teste de sincronização usa respostas simuladas. A interface mantém MSAL e o JSON privado; não publica planilha, mapa, conta, tokens nem backups. O espelho de acompanhamento é diferente da planilha financeira original.

## Privacidade da versão publicada

Links e resumos particulares antes embutidos no HTML foram retirados. A localização do arquivo é resolvida na conta Microsoft e fica somente no JSON privado. Uma cópia recuperável desses metadados foi entregue ao proprietário separadamente; pode ser importada em Configurações > Importar JSON, sem apagar os registros existentes. Os valores iniciais de despesas agora vêm da planilha, em vez de constantes particulares no HTML.

Essa limpeza muda a versão atual. Não reescreve o histórico de commits antigos do repositório, que já era público.


## Correção da TR — 11/10/2026

O cenário do aplicativo incorpora a TR ao saldo mensal: saldo corrigido = saldo inicial × (1 + TR). Juros e amortização SAC são calculados sobre esse saldo; MIP e o seguro proporcional também usam o saldo corrigido. O saldo final é o saldo corrigido menos amortização e aportes, limitado a zero. Aportes são limitados ao saldo após a amortização. FGHAB continua fora da parcela. Principal preservado em R$339.000.

A taxa TR continua derivada de TBF e das faixas a/b da planilha; não foi substituída por uma taxa arbitrária. O primeiro mês permanece com TR zero, conforme a origem.

A planilha atualizada tem FGTS de R$77.000, indicador de quitação em junho, coluna K corrigida e cronograma com diferença de fontes zero. Sua fórmula de saldo ainda não incorpora TR. Por isso a importação confere o cenário original em modo de referência e o app aplica a correção autorizada após a conferência. O modo de referência não é usado nos cenários exibidos.

Validação: 9.697 valores e 8.385 fórmulas da referência atualizada, sem divergências acima de R$0,01. Cálculo independente em Python: 4.130 valores mensais em 413 meses, diferença máxima zero, no cenário sem lançamentos adicionais. O cenário corrigido manteve quitação em junho de 2044. Testes de aportes, despesas e edição cobrem cenários sintéticos. Valores salvos da planilha não equivalem a recálculo ao vivo no Excel; integração real com OneDrive não foi exercitada nesta validação.
