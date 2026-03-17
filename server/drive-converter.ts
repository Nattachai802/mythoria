import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';
import { diff_match_patch } from 'diff-match-patch';

export type FormatSnapshot = {
  version: number;
  elements: {
    placeholder: string;
    type: string;
    index: number;
    data: any;
  }[];
};

export function extractFormatSnapshot(deltaOps: any[]): { cleanedOps: any[], snapshot: FormatSnapshot } {
  const snapshot: FormatSnapshot = { version: 1, elements: [] };
  const cleanedOps = [];
  
  let currentIndex = 0;

  for (const op of deltaOps) {
    if (op.insert && typeof op.insert === 'object') {
      const type = Object.keys(op.insert)[0];
      const placeholder = `[[${type.toUpperCase()}_${snapshot.elements.length}]]`;
      
      snapshot.elements.push({
        placeholder,
        type,
        index: currentIndex,
        data: op.insert
      });

      cleanedOps.push({ insert: placeholder, attributes: op.attributes });
      currentIndex += placeholder.length;
    } else {
      cleanedOps.push(op);
      if (typeof op.insert === 'string') {
        currentIndex += op.insert.length;
      }
    }
  }

  return { cleanedOps, snapshot };
}

export function quillDeltaToHtml(deltaOps: any[]): string {
  const converter = new QuillDeltaToHtmlConverter(deltaOps, {
    paragraphTag: 'p',
  });
  return converter.convert();
}

export function htmlToGoogleDocsRequests(htmlString: string) {
  const requests: any[] = [];
  
  const plainText = htmlString
    // ย่อหน้าที่กด Enter ทิ้งไว้เฉยๆ -> เว้น 2 บรรทัด
    .replace(/<p><br><\/p>/gi, '\n\n')
    // จบย่อหน้าปกติ -> ขึ้นบรรทัดใหม่แล้วเว้นอีก 1 บรรทัด (เพื่อให้เกิดช่องว่าง)
    .replace(/<\/p>/gi, '\n\n')
    // การกด Shift+Enter (ขึ้นบรรทัดใหม่แต่ในย่อหน้าเดิม) -> ขึ้นบรรทัดใหม่ 1 ครั้ง
    .replace(/<br>/gi, '\n')
    // ลบ HTML Tags อื่นๆ ออกให้หมด
    .replace(/<[^>]*>?/gm, '')
    // ตัดช่องว่างและเว้นบรรทัดส่วนเกินที่หัว-ท้ายออก และเติม \n ท้ายสุด (Google Docs บังคับให้จบ document ด้วย \n เสมอ)
    .trim() + '\n';

  requests.push({
    insertText: {
      location: {
        index: 1
      },
      text: plainText
    }
  });

  return requests;
}


export function googleDocToHtml(docContent: any): string {
  let fullText = "";
  if (!docContent || !docContent.body || !docContent.body.content) {
    return "";
  }

  // 1. ดึงข้อความดิบทั้งหมดออกมาจากทุึก Elements
  for (const element of docContent.body.content) {
    if (element.paragraph) {
      for (const pElement of element.paragraph.elements) {
        if (pElement.textRun && pElement.textRun.content) {
          fullText += pElement.textRun.content;
        }
      }
    }
  }

  // 2. ทำการ Reversing Spacing Logic
  const html = fullText
    .replace(/\r\n/g, '\n') // ปรับ newline ให้เป็นมาตรฐานเดียว
    .trim()
    // เราเคยแทน </p> ด้วย \n\n ดังนั้นการเจอ \n\n (หรือมากกว่านั้น) แปลว่าควรจบย่อหน้า
    .split(/\n\n+/)
    .map(paragraph => {
      // ถ้าข้างในย่อหน้ามี \n เดียวๆ (จากการกด Shift+Enter) ให้เปลี่ยนเป็น <br>
      const cleanPara = paragraph.trim().replace(/\n/g, '<br>');
      return cleanPara ? `<p>${cleanPara}</p>` : "";
    })
    .join('');

  return html;
}

export function htmlToQuillDelta(htmlString: string): any {
  const textContent = htmlString.replace(/<p>/g, '').replace(/<\/p>/g, '\n');
  return {
    ops: [
      { insert: textContent }
    ]
  };
}

export function restoreFromSnapshot(deltaObj: any, snapshot: FormatSnapshot): any {
  return deltaObj;
}

export function diffAndMerge(base: string, local: string, remote: string) {
  const dmp = new diff_match_patch();
  
  // ใช้ diff-match-patch เทียบว่า Remote (Google Docs) มีอะไรต่างจาก Base
  const patches = dmp.patch_make(base, remote);
  
  // นำความต่างนั้น (Patches) ยัดลงใส่ใน Local (Mythoria) แบบหยาบๆ 
  const [mergedText, results] = dmp.patch_apply(patches, local);
  
  // เช็คว่า Apply patch ได้สมบูรณ์ทุกตัวไหม ถ้าไม่รอด แปลว่า Conflict!
  const hasConflict = results.some((r: boolean) => r === false);

  return {
    mergedText,
    hasConflict
  };
}
