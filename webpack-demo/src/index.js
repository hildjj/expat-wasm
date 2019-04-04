import XmlParser from 'expat-wasm'

async function component () {
  console.log(XmlParser)

  const parser = await XmlParser.create()
  parser.on('startElement', e => {
    console.log(e)
    let element = document.createElement('div')
    element.innerHTML = e
    document.body.appendChild(element)
  })
  parser.parse('<foo><bar/></foo>')
}

component().then(console.log)
