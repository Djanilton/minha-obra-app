# Minha Obra

Aplicativo particular com interface pública e dados privados no OneDrive. Principal obrigatório: R$339.000; FGTS inicial do cenário migrado: R$77.000.

O motor JavaScript calcula SAC, TR, MIP, aportes, reserva e cronograma sem executar fórmulas no Excel. A importação carrega entradas, extrai constantes numéricas e compara o cenário original com os valores salvos no arquivo. A primeira importação exige conexão para carregar o leitor XLSX; o cálculo funciona com a página carregada sem conexão.

Abra Premissas, importe a planilha atualizada ou use Ler planilha do OneDrive. A importação só é aplicada quando a conferência passa. Depois, edite Despesas e Parâmetros Construção; programe aportes no painel. Despesas previstas reservam recursos no saldo inicial, seguindo a origem; valores pagos são controlados separadamente.

Detalhes: [docs/CALCULOS.md](docs/CALCULOS.md).

Testes: `node --test tests/engine.test.js`. Para o navegador: Playwright e Chromium instalados, `node --test tests/browser.test.cjs`. Pode-se fornecer PLAYWRIGHT_MODULE e CHROME_PATH.

Conferência privada: `python tools/extract_workbook.py arquivo.xlsx private-map.json`; depois `node tests/validate-reference.cjs private-map.json`. Nunca envie planilhas, mapas privados, tokens ou backups JSON ao repositório.
