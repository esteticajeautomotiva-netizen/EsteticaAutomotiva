// ============================================================
// CLOUDINARY CONFIG — J&E Estética Automotiva
// ============================================================
const CLOUDINARY_CONFIG = {
  cloudName: "dmqtygmro",
  uploadPreset: "je-estetica",
  folder: "je-estetica-automotiva"
};

// ============================================================
// Upload de imagem para o Cloudinary
// @param {File} file — objeto File do input
// @param {string} subfolder — ex: "gallery", "services", "specialists"
// @returns {Promise<string>} URL da imagem
// ============================================================
async function uploadToCloudinary(file, subfolder = "misc") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  formData.append("folder", `${CLOUDINARY_CONFIG.folder}/${subfolder}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) throw new Error("Falha no upload da imagem");
  const data = await response.json();
  return data.secure_url;
}

// Upload com preview — retorna URL e mostra loading visual
async function uploadWithFeedback(file, subfolder, btnEl) {
  const original = btnEl ? btnEl.innerHTML : null;
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="spinner"></span> Enviando...';
  }
  try {
    const url = await uploadToCloudinary(file, subfolder);
    return url;
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = original;
    }
  }
}