const App = () => {
  return {
    data: {
      sliceSize: 5,
      sliceType: "size",
      sliceLines: 250,
      resultType: "zip",
      status: "idle",
      file: null,
      fileSize: 0,
      fullName: "",
      fileName: "file",
      worker: null,
      progress: 0,

      files: [],
      lineSeparator: "\n",
      header: true,
      zip: null,
      
      reason: null
    },

    handleOnInitializeApp() {
      this.handleOnInitializeWorker();
    },

    handleOnInitializeWorker() {
      this.data.worker = new Worker("slicer.js");
      this.data.worker.addEventListener("message", (event) => {
        this.handleOnReceiveMessage(event);
      });
    },

    handleOnClickTerminate() {
      this.data.worker.terminate();
      this.data.worker.terminated = true;
      this.data.file = null;
      this.data.zip = null;
      this.data.status = "stopped";
      document.getElementById("file").value = null;
    },

    handleOnClickClearStatus() {
      this.data.files = [];
      this.data.file = null;
      this.data.fullName = null;
      this.data.status = "idle";
      document.getElementById("file").value = null;
    },

    async handleOnReceiveMessage(event) {
      const { type, value } = event.data;

      if (type === "status" && value.status === "completed") {
        if (this.data.resultType === "zip" && this.data.zip !== null) {
          this.data.status = "compressing";
          try {
            const zipData = await this.data.zip.generateAsync(
              {
                type: "blob",
                streamFiles: true,
              },
              (meta) => {
                this.data.progress = Math.round(meta.percent || 0);
              }
            );
            this.data.files = [
              {
                url: URL.createObjectURL(zipData),
                name: this.data.fileName + ".zip",
                target: "_blank",
                text: this.data.fileName + ".zip",
                download: true,
              },
            ];
            this.data.status = "completed";
          } catch (error) {
            this.data.reason = "error:compressing";
            this.data.status = "error";
          }
        } else {
          this.data.status = "completed";
        }
      }

      if (type === "status" && value.status === "progress") {
        if (value.progress % 4 === 0) {
          this.data.progress = value.progress;
        }
        this.data.status = "processing";
      }

      if (type === "file" && value.file && value.name) {
        if (this.data.resultType === "zip") {
          if (!this.data.zip) {
            this.data.zip = new JSZip();
          }
          this.data.zip.file(value.name, value.file);
        } else {
          this.data.files = [
            ...this.data.files,
            {
              url: URL.createObjectURL(value.file),
              name: value.name,
              target: "_blank",
              text: `${value.name} (${this.getBytesForHuman(value.size)})`,
              download: true,
            },
          ];
        }
      }
    },

    handleOnChangeFile(event) {
      const file = event.target?.files?.[0];
      if (!file) return;

      this.data.file = file;

      if (this.data.files.length > 0) {
        this.data.files = [];
      }

      this.data.fileName = file.name.split(".").slice(0, -1)?.[0] || "file";
      this.data.fileSize = this.getBytesForHuman(file.size);
      this.data.fullName = file.name + " (" + this.data.fileSize + ")";
    },

    handleOnFormSubmit() {
      if (this.data.worker.terminated === true) {
        this.handleOnInitializeWorker();
      }
      this.data.worker.postMessage({
        file: this.data.file,
        fileName: this.data.fileName,
        lineSeparator: this.data.lineSeparator,
        header: this.data.header,
        sliceType: this.data.sliceType,
        sliceLines: this.data.sliceLines,
        sliceSize: (this.data.sliceSize || 5) * 1_000_000,
      });
    },

    getBytesForHuman(bytes) {
      let units = ["B", "KB", "MB", "GB", "TB", "PB"];
      let i = 0;
      for (i; bytes > 1024; i++) {
        bytes /= 1024;
      }
      return bytes.toFixed(1) + " " + units[i];
    },

    getLabelForInputTypeFile() {
      if (this.data.file && this.data.fullName) {
        return this.data.fullName;
      }
      return "É aqui que você vai carregar o seu arquivo para ser cortado";
    },
  };
};
