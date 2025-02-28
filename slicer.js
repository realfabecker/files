self.addEventListener("message", async (event) => {
  const { file, sliceSize, lineSeparator, sliceType, sliceLines, header, fileName } =
    event.data;
  const decoder = new TextDecoder();
  const stream = file.stream();
  const reader = stream.getReader();

  let files = 0;
  let chunks = [];
  let sizes = 0;
  let lines = 0;
  let total = 0;

  if (header) {
    const { value } = await reader.read();
    chunks.push(decoder.decode(value, { stream: true }));
    sizes += sizeOfStringUTF8(chunks[0]);
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

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
        self.postMessage(this.newMessageTypeFile(blob, ++files, fileName));
        chunks = header ? [chunks[0]] : [];
        sizes = 0;
        lines = 0;
      }
    });

    total += value.length;
    self.postMessage(this.newMessageTypeWork((total / file.size) * 100));
  }
  if (chunks.length) {
    const blob = new Blob(chunks, { type: file.type });
    self.postMessage(this.newMessageTypeFile(blob, ++files, fileName));
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

function newMessageTypeWork(progress) {
  return {
    type: "status",
    value: { status: "progress", progress: Math.round(progress) },
  };
}

function newMessageTypeDone() {
  return { type: "status", value: { status: "completed" } };
}

function newMessageTypeFile(blob, files, fileName) {
  return {
    type: "file",
    value: {
      file: blob,
      name: `${fileName}-${String(++files).padStart(2, "0")}.csv`,
      size: blob.size,
    },
  };
}
