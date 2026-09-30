# Development notes for the interactive labs

The Arabic writing and original site design are licensed as stated in the repository root LICENSE. Third-party software, models, fonts and frameworks retain their own licenses.

The CSV/Excel lab loads Pyodide and ExcelJS on demand; the R lab loads webR on demand; experimental semantic search loads Transformers.js and the Xenova multilingual sentence-transformer model on demand. The site has no data-upload endpoint; however third-party CDN requests occur to download code and model files, so avoid claims of full offline operation. Review licenses and update dependencies before modifying or redistributing their source.
