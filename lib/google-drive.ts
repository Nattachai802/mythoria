import { google } from "googleapis";
import { htmlToGoogleDocsRequests } from "@/server/drive-converter";

// เราจะให้เรียกใช้ function SetCredentials ก่อนใช้คำสั่งอื่นๆ เสมอ
// เพื่อให้แน่ใจว่าได้ Token ที่อัปเดตใหม่ล่าสุดเสมอ
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

export function setCredentials(accessToken: string, refreshToken?: string) {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}

// ==========================================
// DRIVE UTILS 
// ==========================================

const drive = google.drive({ version: "v3", auth: oauth2Client });

export async function createDriveFolder(name: string, parentFolderId?: string) {
  const fileMetadata = {
    name: name,
    mimeType: "application/vnd.google-apps.folder",
    parents: parentFolderId ? [parentFolderId] : undefined,
  };

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id",
  });
  
  return folder.data.id;
}

// ==========================================
// DOCS UTILS
// ==========================================

const docs = google.docs({ version: "v1", auth: oauth2Client });

export async function createDoc(title: string, folderId: string) {
  // สร้าง Google Doc ในโฟลเดอร์ที่ระบุ
  const doc = await docs.documents.create({
    requestBody: {
      title: title,
    },
  });

  const docId = doc.data.documentId;

  // เอา Doc ย้ายเข้าโฟลเดอร์ที่เราต้องการ
  if (folderId && docId) {
    await drive.files.update({
      fileId: docId,
      addParents: folderId,
      // ลบจาก root
      removeParents: await getRootFolder(docId),
    });
  }

  return docId;
}

async function getRootFolder(fileId: string) {
  const file = await drive.files.get({
    fileId: fileId,
    fields: "parents",
  });
  return file.data.parents?.[0] || "";
}

export async function getDocContent(docId: string) {
  const response = await docs.documents.get({ documentId: docId });
  return response.data;
}

export async function updateDocContent(docId: string, html: string) {
  if (!html) return;

  // 1. อ่านข้อมูลเอกสารปัจจุบันเพื่อหาจุดสิ้นสุดของเอกสาร (endIndex)
  const doc = await docs.documents.get({ documentId: docId });
  const content = doc.data.body?.content;

  const finalRequests: any[] = [];

  // 2. สร้างคำสั่งลบเนื้อหาเดิม (เคลียร์หน้ากระดาษ)
  if (content && content.length > 0) {
    const lastElement = content[content.length - 1];
    const endIndex = lastElement.endIndex;
    
    // Google Docs ไม่ยอมให้ลบ newline ตัวสุดท้ายของไฟล์ทิ้ง เราจึงลบได้ถึงแค่ endIndex - 1
    if (endIndex && endIndex > 2) {
      finalRequests.push({
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: endIndex - 1,
          }
        }
      });
    }
  }

  // 3. สร้างคำสั่งใส่เนื้อหาใหม่ลงไป
  const writeRequests = htmlToGoogleDocsRequests(html);
  if (writeRequests.length > 0 && writeRequests[0].insertText?.text) {
     finalRequests.push(...writeRequests);
  }

  if (finalRequests.length === 0) return;

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: finalRequests,
    },
  });
}

export async function getDocMetadata(docId: string) {
  const response = await drive.files.get({
    fileId: docId,
    fields: 'modifiedTime',
  });
  return response.data.modifiedTime;
}
