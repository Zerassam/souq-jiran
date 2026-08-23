import { readFile, writeFile } from "node:fs/promises";
import { jsPDF } from "jspdf";

const fontPath = "/home/ubuntu/webdev-static-assets/Amiri-Regular.ttf";
const outputPath = "/home/ubuntu/webdev-static-assets/souq-jiran-arabic-pdf-verification.pdf";

const fontBase64 = (await readFile(fontPath)).toString("base64");
const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

pdf.addFileToVFS("Amiri-Regular.ttf", fontBase64);
pdf.addFont("Amiri-Regular.ttf", "Amiri", "normal", 400, "Identity-H");
pdf.setFont("Amiri", "normal");
pdf.setFillColor(247, 248, 252);
pdf.rect(0, 0, 210, 297, "F");
pdf.setFillColor(91, 91, 247);
pdf.roundedRect(18, 18, 174, 20, 5, 5, "F");

function writeArabic(text, y, size, color) {
  pdf.setFont("Amiri", "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
  pdf.setR2L(true);
  pdf.text(text, 105, y, { align: "center", isInputRtl: true });
  pdf.setR2L(false);
}

writeArabic("سوق الجيران · اطلب من المنزل", 31, 19, [255, 255, 255]);
writeArabic("الجوهرة", 57, 22, [23, 32, 51]);
writeArabic("ميلة · ميلة", 66, 12, [105, 115, 134]);
writeArabic("امسح الرمز لتطلب مباشرة من محلك", 210, 15, [23, 32, 51]);
writeArabic("سوق الجيران · طلبات محلية وتوصيل منظم", 220, 10, [105, 115, 134]);

await writeFile(outputPath, new Uint8Array(pdf.output("arraybuffer")));
console.log(outputPath);
