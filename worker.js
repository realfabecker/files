self.addEventListener("message", async (event) => {
  const { file, sliceSize, lineSeparator, sliceType, sliceLines } = event.data;
  const decoder = new TextDecoder();
  const stream = file.stream();
  const reader = stream.getReader();

  let files = 0;
  let chunks = [];
  let sizes = 0;
  let lines = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    self.postMessage(this.newMessageTypeWork());
    const text = decoder.decode(value, { stream: true });

    text.split(lineSeparator).forEach((line) => {
      chunks.push(line + lineSeparator);
      sizes += sizeOfStringUTF8(line);
      lines += 1;

      if (
        (sliceType === "line" && sliceLines && lines >= sliceLines) ||
        (sliceType === "size" && sliceSize && sizes >= sliceSize)
      ) {
        const blob = new Blob(chunks, { type: file.type });
        self.postMessage(this.newMessageTypeFile(blob, ++files));
        chunks = [];
        sizes = 0;
        lines = 0;
      }
    });
  }
  if (chunks.length) {
    const blob = new Blob(chunks, { type: file.type });
    self.postMessage(this.newMessageTypeFile(blob, ++files));
  }
  self.postMessage(this.newMessageTypeDone());
});

function sizeOfStringUTF8(str) {
  let utf8Length = 0;
  for (let i = 0; i < str.length; i++) {
    const charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      utf8Length += 1;
    } else if (charcode < 0x800) {
      utf8Length += 2;
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8Length += 3;
    } else {
      i++;
      utf8Length += 4;
    }
  }
  return utf8Length;
}

function newMessageTypeWork() {
  return { type: "status", value: { status: "progress" } };
}

function newMessageTypeDone() {
  return { type: "status", value: { status: "completed" } };
}

function newMessageTypeFile(blob, files) {
  return {
    type: "file",
    value: {
      file: blob,
      name: `file-${String(++files).padStart(2, "0")}`,
      size: blob.size,
    },
  };
}
