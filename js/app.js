let zip
let currentFile = null
let files = {}

let opfPath = null
let opfXml = null

const editor = CodeMirror.fromTextArea(
  document.getElementById("editor"),
  {
    mode: "application/xml",
    lineNumbers: true,
    lineWrapping: true
  }
)

const tree = document.getElementById("tree")
const iframe = document.getElementById("iframe")

/* EPUB 업로드 */
document.getElementById("fileInput").addEventListener("change", async e => {
  zip = await JSZip.loadAsync(e.target.files[0])
  files = {}
  currentFile = null

  // 파일 트리 초기화 (메타 패널 제외)
  tree.querySelectorAll(".file").forEach(n => n.remove())

  // OPF 로드
  await loadOpf()

  for (const path in zip.files) {
    if (!zip.files[path].dir) {
      const div = document.createElement("div")
      div.className = "file"
      div.textContent = path
      div.onclick = () => openFile(path)
      tree.appendChild(div)
    }
  }
})

/* 파일 열기 */
async function openFile(path) {
  if (currentFile) {
    zip.file(currentFile, editor.getValue())
  }

  currentFile = path
  const text = await zip.file(path).async("text")
  editor.setValue(text)

  if (path.endsWith(".xhtml") || path.endsWith(".html")) {
    iframe.srcdoc = text
  } else {
    iframe.srcdoc = ""
  }
}

/* 저장 */
document.getElementById("saveBtn").onclick = async () => {
  if (!zip) return alert("EPUB을 먼저 열어주세요")

  if (currentFile) {
    zip.file(currentFile, editor.getValue())
  }

  const blob = await zip.generateAsync({ type: "blob" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "edited.epub"
  a.click()
}

/* OPF 메타데이터 */
async function loadOpf() {
  for (const p in zip.files) {
    if (p.endsWith(".opf")) {
      opfPath = p
      const text = await zip.file(p).async("text")
      opfXml = new DOMParser().parseFromString(text, "application/xml")

      metaTitle.value =
        opfXml.querySelector("dc\\:title")?.textContent ?? ""
      metaCreator.value =
        opfXml.querySelector("dc\\:creator")?.textContent ?? ""
      metaLang.value =
        opfXml.querySelector("dc\\:language")?.textContent ?? ""
      metaUUID.value =
        opfXml.querySelector("dc\\:identifier")?.textContent ?? ""
    }
  }
}

document.getElementById("applyMeta").onclick = () => {
  if (!opfXml) return

  opfXml.querySelector("dc\\:title").textContent = metaTitle.value
  opfXml.querySelector("dc\\:creator").textContent = metaCreator.value
  opfXml.querySelector("dc\\:language").textContent = metaLang.value
  opfXml.querySelector("dc\\:identifier").textContent =
    metaUUID.value || "urn:uuid:" + crypto.randomUUID()

  zip.file(opfPath, new XMLSerializer().serializeToString(opfXml))
  alert("메타데이터 적용 완료")
}

/* 커버 이미지 교체 */
document.getElementById("coverInput").addEventListener("change", async e => {
  const file = e.target.files[0]
  if (!file || !opfXml) return

  let coverItem =
    opfXml.querySelector('item[properties~="cover-image"]')

  if (!coverItem) {
    alert("cover-image 항목이 없습니다")
    return
  }

  const href = coverItem.getAttribute("href")
  zip.file(href, await file.arrayBuffer())

  updateCoverXhtml(href)
  alert("표지 이미지 교체 완료")
})

function updateCoverXhtml(imageHref) {
  for (const p in zip.files) {
    if (p.toLowerCase().includes("cover") && p.endsWith(".xhtml")) {
      zip.file(p).async("text").then(text => {
        const updated = text.replace(
          /<img[^>]+src=["'][^"']+["']/i,
          `<img src="${imageHref}"`
        )
        zip.file(p, updated)
      })
      return
    }
  }

  // cover.xhtml 없으면 생성
  zip.file(
    "Text/cover.xhtml",
    `
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Cover</title></head>
<body style="margin:0">
  <img src="${imageHref}" style="width:100%;height:auto"/>
</body>
</html>
`
  )
}
