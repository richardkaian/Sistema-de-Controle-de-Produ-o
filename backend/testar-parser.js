// testar-parser.js
// Uso: node testar-parser.js caminho/do/arquivo.pdf
const fs = require('fs');
const { extrairOS } = require('./os-parser.js');

const caminho = process.argv[2];
if (!caminho) {
  console.error('Uso: node testar-parser.js caminho/do/arquivo.pdf');
  process.exit(1);
}

const buffer = fs.readFileSync(caminho);
extrairOS(buffer)
  .then((dados) => console.log(JSON.stringify(dados, null, 2)))
  .catch((erro) => {
    console.error('Falha ao extrair OS:', erro.message);
    process.exit(1);
  });
