import XmlParser from 'expat-wasm'

const input = document.querySelector('#input')
const output = document.querySelector('#output')
const parser = new XmlParser()
parser.on('*', (event, ...args) => {
  const element = document.createElement('div')
  element.innerHTML = `${event}: ${args.map(a => JSON.stringify(a)).join(', ')}`

  output.appendChild(element)
})

function process() {
  output.innerHTML = ''
  try {
    parser.parse(input.value, 1)
  } catch (e) {
    output.innerText = `\
Message: ${e.xmlMessage}
Code: ${e.code}
Line: ${e.line}
Column: ${e.column}
Byte Offset: ${e.byteOffset}
    `
  }
}
input.addEventListener('input', process)
process()
