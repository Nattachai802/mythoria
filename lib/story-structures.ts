// รากฐานของระบบโครงเรื่อง — ฐานข้อมูล story structure 10 แบบ (static reference)
// ใช้ได้ทั้ง cheat sheet ตอนนี้ และ structure overlay บนกระดานพล็อตในอนาคต
// pos = ตำแหน่งโดยประมาณเป็น % ของเรื่อง (มีเฉพาะเฟรมเวิร์กที่ระบุจังหวะตามตำแหน่ง)
// ที่มา: story_structures_framework.md

export interface StructureStage {
    name: string        // ชื่อจังหวะ (EN/ดั้งเดิม)
    nameTh?: string     // ชื่อไทย ถ้ามี
    desc: string        // อธิบายสั้นๆ ว่าเกิดอะไร
    pos?: number        // ตำแหน่ง % (0–100) สำหรับ overlay; ไม่มี = เป็นลำดับขั้น ไม่ผูกตำแหน่ง
}

export interface StoryStructure {
    id: string
    nameEn: string
    nameTh: string
    coreFocus: string
    genres: string[]
    complexity: "Low" | "Medium" | "High"
    description: string
    positional: boolean // true = วาง beat ตาม % ได้ (ใช้ overlay ได้), false = เป็นกระบวนการ/ลูป
    stages: StructureStage[]
}

export const STORY_STRUCTURES: StoryStructure[] = [
    {
        id: "ST-001",
        nameEn: "3-Act Structure",
        nameTh: "โครงสร้าง 3 องก์",
        coreFocus: "Plot Architecture & Pacing",
        genres: ["ทุกแนว", "ดราม่า", "แอ็กชัน", "ระทึกขวัญ"],
        complexity: "Medium",
        description:
            "โครงสร้างสากลที่เก่าแก่และแพร่หลายที่สุด รากฐานจากอริสโตเติล แบ่งเป็น 3 ส่วน ~25%:50%:25% คุมสถาปัตยกรรมหลักของพล็อตให้มีจุดเริ่ม จุดตึงเครียดสูงสุด และบทสรุปที่สมบูรณ์",
        positional: true,
        stages: [
            { name: "Status Quo / Ordinary World", nameTh: "โลกปกติ", desc: "เปิดชีวิตปกติของตัวเอกและปมเริ่มต้น", pos: 0 },
            { name: "Inciting Incident", nameTh: "เหตุการณ์พลิกผัน", desc: "เหตุภายนอกทำลายความปกติ บีบให้ตัวเอกต้องตัดสินใจ", pos: 12 },
            { name: "Plot Point 1", nameTh: "จุดเปลี่ยนที่ 1", desc: "ตัวเอกยอมรับภารกิจ ก้าวเข้า Act 2 อย่างไม่มีทางถอย", pos: 25 },
            { name: "Rising Action", nameTh: "ไต่ระดับ", desc: "เผชิญอุปสรรคยากขึ้น ลองผิดลองถูก รวบรวมมิตร", pos: 37 },
            { name: "Midpoint", nameTh: "จุดกึ่งกลาง", desc: "เหตุการณ์เปลี่ยนทิศพล็อต ชนะหลอกหรือแพ้หลอก เดิมพันสูงขึ้น", pos: 50 },
            { name: "Plot Point 2 / Dark Night", nameTh: "จุดตกต่ำสุด", desc: "พ่ายแพ้หรือสูญเสียสิ่งสำคัญจนดูไม่มีทางชนะ", pos: 75 },
            { name: "Climax", nameTh: "ไคลแมกซ์", desc: "ปะทะครั้งสุดท้ายกับปฏิปักษ์ แก้ปมหลัก", pos: 88 },
            { name: "Resolution", nameTh: "บทสรุป", desc: "สถานการณ์คลี่คลาย เห็นโลก/ชีวิตใหม่ของตัวเอก", pos: 100 },
        ],
    },
    {
        id: "ST-002",
        nameEn: "Save the Cat! 15 Beats",
        nameTh: "จังหวะทั้ง 15 ของ Save the Cat!",
        coreFocus: "Emotional Pacing & Market Viability",
        genres: ["นิยายตลาด", "บทภาพยนตร์", "โรแมนซ์", "สืบสวน", "ระทึกขวัญ"],
        complexity: "High",
        description:
            "พัฒนาโดย Blake Snyder ต่อยอดจาก 3 องก์ ซอยเป็น 15 จังหวะที่กำหนด % ชัดเจน ออกแบบมาคุมอารมณ์คนอ่าน ไม่ให้มีช่วงน่าเบื่อหรือพล็อตยืด",
        positional: true,
        stages: [
            { name: "Opening Image", nameTh: "ภาพเปิด", desc: "ภาพแสดงสถานะและปัญหาในใจตัวเอก ณ จุดเริ่ม", pos: 1 },
            { name: "Theme Stated", nameTh: "ประกาศแก่นเรื่อง", desc: "ตัวละคร/เหตุการณ์พูดถึงแก่นที่ตัวเอกต้องเรียนรู้", pos: 5 },
            { name: "Set-up", nameTh: "ปูเรื่อง", desc: "แนะนำโลก ชีวิต ตัวละครรอบตัว และจุดบกพร่องที่ต้องแก้", pos: 10 },
            { name: "Catalyst", nameTh: "ตัวเร่ง", desc: "เหตุพลิกผันที่พังโลกใบเดิม (= Inciting Incident)", pos: 12 },
            { name: "Debate", nameTh: "ลังเล", desc: "ตัวเอกลังเล ปฏิเสธ ประเมินความเสี่ยงก่อนลุย", pos: 18 },
            { name: "Break into Two", nameTh: "ก้าวสู่องก์สอง", desc: "ตัดสินใจเข้า Act 2 ทิ้งโลกเก่าไว้เบื้องหลัง", pos: 25 },
            { name: "B Story", nameTh: "เส้นเรื่องรอง", desc: "เปิดเส้นรอง (รัก/มิตรภาพ/ที่ปรึกษา) ที่จะสอนแก่นเรื่อง", pos: 30 },
            { name: "Fun and Games", nameTh: "ขายไอเดียหลัก", desc: "ช่วงสนุก/ผจญภัยที่คนอ่านคาดหวังจากคำโปรย", pos: 40 },
            { name: "Midpoint", nameTh: "จุดกึ่งกลาง", desc: "เดิมพันยกสูง ชัยชนะหลอกหรือพ่ายแพ้หลอก", pos: 50 },
            { name: "Bad Guys Close In", nameTh: "ศัตรูประชิด", desc: "อุปสรรคภายนอกและแรงกดดันภายในถาโถม", pos: 62 },
            { name: "All Is Lost", nameTh: "สิ้นหวังสูงสุด", desc: "จุดต่ำสุด มักมีการตาย (จริงหรือเชิงเปรียบ) ตัดความหวัง", pos: 75 },
            { name: "Dark Night of the Soul", nameTh: "ราตรีมืดของจิตวิญญาณ", desc: "จมกับความล้มเหลว ก่อนตระหนักทางออกที่แท้จริง", pos: 80 },
            { name: "Break into Three", nameTh: "ก้าวสู่องก์สาม", desc: "คิดแผนใหม่จาก B Story พร้อมสู้ครั้งสุดท้าย", pos: 85 },
            { name: "Finale", nameTh: "ไคลแมกซ์", desc: "ลงมือตามแผนใหม่ ทำลายผู้ร้าย สร้างโลกที่ดีกว่า", pos: 92 },
            { name: "Final Image", nameTh: "ภาพปิด", desc: "ภาพตรงข้ามกับภาพเปิด พิสูจน์ว่าตัวเอกเปลี่ยนไปสิ้นเชิง", pos: 100 },
        ],
    },
    {
        id: "ST-003",
        nameEn: "The Hero's Journey (Monomyth)",
        nameTh: "การเดินทางของวีรบุรุษ",
        coreFocus: "Character Transformation & Mythological Archetypes",
        genres: ["แฟนตาซีมหากาพย์", "ไซไฟ", "ผจญภัย"],
        complexity: "High",
        description:
            "ค้นพบโดย Joseph Campbell ปรับใช้กับหนังโดย Christopher Vogler เน้นการเปลี่ยนผ่านตัวตนของฮีโร่จากคนธรรมดาสู่ผู้กล้า ผ่านการข้ามพรมแดนสู่โลกที่เต็มไปด้วยอันตราย",
        positional: true,
        stages: [
            { name: "The Ordinary World", nameTh: "โลกปกติ", desc: "โลกเดิมของตัวเอก แสดงปมและความไม่สมบูรณ์", pos: 0 },
            { name: "The Call to Adventure", nameTh: "เสียงเรียก", desc: "เหตุการณ์ที่เชิญชวนให้ยอมรับภารกิจ", pos: 10 },
            { name: "Refusal of the Call", nameTh: "ปฏิเสธเสียงเรียก", desc: "ตัวเอกปฏิเสธเพราะกลัว/ผูกพัน/ไม่พร้อม", pos: 15 },
            { name: "Meeting with the Mentor", nameTh: "พบที่ปรึกษา", desc: "ได้พบผู้รู้หรือได้ของวิเศษเพื่อเตรียมพร้อม", pos: 20 },
            { name: "Crossing the First Threshold", nameTh: "ข้ามพรมแดนแรก", desc: "ก้าวเข้าโลกพิเศษที่กฎไม่เหมือนเดิม", pos: 25 },
            { name: "Tests, Allies, Enemies", nameTh: "บททดสอบ มิตร ศัตรู", desc: "เผชิญการทดสอบ สร้างพันธมิตร เรียนรู้ศัตรู", pos: 35 },
            { name: "Approach to the Inmost Cave", nameTh: "เข้าใกล้ถ้ำชั้นใน", desc: "เดินสู่ใจกลางอันตราย/ที่ตั้งเป้าหมายหลัก", pos: 45 },
            { name: "The Ordeal", nameTh: "การทดสอบครั้งใหญ่", desc: "เผชิญหน้าความตายหรือความกลัวที่ยิ่งใหญ่ที่สุด", pos: 55 },
            { name: "Reward (Seizing the Sword)", nameTh: "รางวัล", desc: "รอดชีวิตและได้รางวัล (พลัง อาวุธ ความรู้ สัจธรรม)", pos: 65 },
            { name: "The Road Back", nameTh: "เส้นทางกลับ", desc: "เดินทางกลับ มักมีการไล่ล่าหรือผลกระทบตามมา", pos: 75 },
            { name: "The Resurrection", nameTh: "การเกิดใหม่", desc: "การทดสอบขั้นสุดท้าย ใช้ทุกสิ่งที่เรียนรู้เพื่อเกิดใหม่", pos: 90 },
            { name: "Return with the Elixir", nameTh: "กลับพร้อมยาวิเศษ", desc: "กลับโลกเดิมพร้อมสิ่งที่จะเยียวยาโลกให้สงบสุข", pos: 100 },
        ],
    },
    {
        id: "ST-004",
        nameEn: "Dan Harmon's Story Circle",
        nameTh: "วงกลมเรื่องเล่าของแดน ฮาร์มอน",
        coreFocus: "Character Desire & Cyclic Psychology",
        genres: ["ซิทคอม", "เรื่องสั้น", "คอเมดี", "แอนิเมชัน"],
        complexity: "Low",
        description:
            "โมเดลทรงกลม 8 ขั้น ย่อจาก Hero's Journey ให้กระชับและเป็นวัฏจักร เน้นความต้องการเชิงลึก: ได้สิ่งหนึ่งมักเสียอีกสิ่ง แล้ววนกลับจุดเริ่มพร้อมวุฒิภาวะที่มากขึ้น",
        positional: true,
        stages: [
            { name: "YOU", nameTh: "ตัวละครในจุดสบาย", desc: "แนะนำตัวละครในสถานการณ์ปกติที่คุ้นเคย", pos: 0 },
            { name: "NEED", nameTh: "มีความต้องการ", desc: "ตระหนักว่ามีบางอย่างขาดหายหรือต้องการสิ่งใหม่", pos: 12 },
            { name: "GO", nameTh: "เข้าสู่โลกใหม่", desc: "ก้าวข้ามขอบเขตเดิมสู่สถานการณ์ที่ไม่คุ้นเคย", pos: 25 },
            { name: "SEARCH", nameTh: "ค้นหาและปรับตัว", desc: "ดิ้นรน ค้นหา เผชิญความท้าทาย ลองวิธีต่างๆ", pos: 37 },
            { name: "FIND", nameTh: "ได้สิ่งที่ต้องการ", desc: "ได้รับสิ่งที่ตามหา (มักเป็นชัยชนะทางวัตถุ)", pos: 50 },
            { name: "TAKE", nameTh: "จ่ายราคาแพง", desc: "เผชิญผลกระทบสาหัส หรือเสียสิ่งสำคัญเพื่อรักษาสิ่งที่ได้", pos: 62 },
            { name: "RETURN", nameTh: "กลับสู่โลกเดิม", desc: "เดินทางกลับมายังจุดเริ่มหรือสถานะเดิม", pos: 80 },
            { name: "CHANGE", nameTh: "พร้อมเปลี่ยนแปลง", desc: "มองโลกไม่เหมือนเดิม ตัวตนภายในเปลี่ยนถาวร", pos: 100 },
        ],
    },
    {
        id: "ST-005",
        nameEn: "The 7-Point Story Structure",
        nameTh: "โครงสร้างพล็อต 7 จุด",
        coreFocus: "Logical Plot Anchors & Structural Balance",
        genres: ["ไซไฟ", "สืบสวน", "แฟนตาซีมหากาพย์", "นิยายขับเคลื่อนด้วยพล็อต"],
        complexity: "Medium",
        description:
            "เสนอโดย Dan Wells นิยมในหมู่นักวางแผน จุดเด่นคือ 'คิดจากปลายทางย้อนกลับมาต้นทาง' (Reverse Engineering) เพื่อสร้างตรรกะที่สมดุลระหว่างจุดเริ่มและจุดจบ",
        positional: true,
        stages: [
            { name: "The Hook", nameTh: "จุดเกี่ยว", desc: "ตัวละครอยู่ในสถานะ 'ตรงข้ามกับตอนจบ' โดยสิ้นเชิง", pos: 0 },
            { name: "Plot Turn 1", nameTh: "จุดเปลี่ยนที่ 1", desc: "ความรู้/เหตุการณ์ใหม่ดึงเข้าเนื้อหาหลัก แนะนำปมขัดแย้ง", pos: 17 },
            { name: "Pinch Point 1", nameTh: "จุดกดดันที่ 1", desc: "แรงกดดันจากฝ่ายตรงข้ามโจมตี สถานการณ์แย่ลง", pos: 33 },
            { name: "Midpoint", nameTh: "จุดกึ่งกลาง", desc: "ตัวเอกเปลี่ยนจากผู้ถูกกระทำ เป็นผู้เริ่มลงมือ", pos: 50 },
            { name: "Pinch Point 2", nameTh: "จุดกดดันที่ 2", desc: "แผนพัง วิกฤตรุนแรงกดดันถึงขีดสุด (= All is Lost)", pos: 67 },
            { name: "Plot Turn 2", nameTh: "จุดเปลี่ยนที่ 2", desc: "ค้นพบกุญแจ/ไอเดียสุดท้ายที่จะใช้แก้ปัญหา", pos: 83 },
            { name: "The Resolution", nameTh: "บทสรุป", desc: "ไคลแมกซ์และคลี่คลายปม ไปถึงเป้าหมายที่ตั้งไว้", pos: 100 },
        ],
    },
    {
        id: "ST-006",
        nameEn: "Freytag's Pyramid / 5-Act Structure",
        nameTh: "พีระมิดของไฟรทาก / โครงสร้าง 5 องก์",
        coreFocus: "Dramatic Tension & Tragic Descent",
        genres: ["โศกนาฏกรรม", "แฟนตาซีดาร์ก", "ดราม่าคลาสสิก", "สยองขวัญจิตวิทยา"],
        complexity: "Medium",
        description:
            "คิดค้นโดย Gustav Freytag จุดต่างสำคัญคือ Climax อยู่กึ่งกลางพีระมิดพอดี หลังจากนั้นไม่คลี่คลายอย่างสุข แต่ดิ่งสู่ความพินาศ (Catastrophe) เหมาะกับโศกนาฏกรรม/แนวดาร์ก",
        positional: true,
        stages: [
            { name: "Exposition", nameTh: "เกริ่นนำ", desc: "แนะนำตัวละคร ฉากหลัง ความสัมพันธ์ แรงจูงใจ", pos: 0 },
            { name: "Rising Action", nameTh: "ไต่ระดับความขัดแย้ง", desc: "ปมทวีความรุนแรง วิกฤตย่อยนำสู่ยอดพีระมิด", pos: 25 },
            { name: "Climax", nameTh: "จุดวิกฤตสูงสุด", desc: "จุดเปลี่ยนกลางเรื่องที่โชคชะตาตัวเอกพลิกผัน", pos: 50 },
            { name: "Falling Action", nameTh: "ผลลัพธ์ดิ่งลง", desc: "ผลกระทบหลัง Climax ความตึงเครียดเปลี่ยนเป็นสิ้นหวัง", pos: 75 },
            { name: "Catastrophe / Resolution", nameTh: "ความพินาศ/จุดจบ", desc: "ความล่มสลายตอนท้าย ตัวเอกพ่ายแพ้ต่อโชคชะตา (กรณี Tragedy)", pos: 100 },
        ],
    },
    {
        id: "ST-007",
        nameEn: "Kishōtenketsu",
        nameTh: "คิโชเทนเคตสึ",
        coreFocus: "Non-Conflict Storytelling & Surprise Interconnection",
        genres: ["สไลซ์ออฟไลฟ์", "มังงะ/อนิเมะ", "สืบสวน", "กวีนิพนธ์เอเชีย"],
        complexity: "Low",
        description:
            "โครงสร้าง 4 องก์จากกวีนิพนธ์จีน-ญี่ปุ่นโบราณ จุดเด่นคือ 'ไม่จำเป็นต้องมีข้อขัดแย้งหลัก' แต่สร้างอารมณ์ด้วยการโยนมุมมองที่คาดไม่ถึงเข้ามาแล้วขมวดรวมตอนจบ",
        positional: true,
        stages: [
            { name: "Ki (起)", nameTh: "เปิดเรื่อง", desc: "แนะนำตัวละคร สถานการณ์ และโลกในมุมปกติ", pos: 0 },
            { name: "Shō (承)", nameTh: "พัฒนา", desc: "ขยายเนื้อหาต่อจากองก์แรกอย่างราบรื่น ไม่มีหักมุมใหญ่", pos: 25 },
            { name: "Ten (転)", nameTh: "หักมุม", desc: "โยนเหตุการณ์/มุมมองใหม่ที่ดูไม่เกี่ยวกับสององก์แรก", pos: 50 },
            { name: "Ketsu (結)", nameTh: "บทสรุป", desc: "ผสาน Ten กับสององก์แรก เผยความสัมพันธ์ที่ซ่อนอยู่", pos: 75 },
        ],
    },
    {
        id: "ST-008",
        nameEn: "The Fichtean Curve",
        nameTh: "เส้นโค้งฟิชเตอาน",
        coreFocus: "Immediate Conflict & Multi-Crisis Escalation",
        genres: ["แอ็กชัน", "ระทึกขวัญ", "สยองขวัญเอาชีวิตรอด", "ผจญภัย"],
        complexity: "Medium",
        description:
            "ตัดการเกริ่นนำทิ้ง ใช้ In Medias Res (เปิดกลางวิกฤต) กราฟตึงเครียดเป็นคลื่นหยักไต่สูงขึ้นเรื่อยๆ ตัวละครเผชิญวิกฤตซ้อนวิกฤตจนถึงไคลแมกซ์ท้ายเรื่อง",
        positional: true,
        stages: [
            { name: "Immediate Crisis", nameTh: "วิกฤตทันที", desc: "เปิดเรื่องมาตัวเอกอยู่ในอันตราย/การต่อสู้ทันที", pos: 0 },
            { name: "Crisis 1", nameTh: "วิกฤตที่ 1", desc: "ผ่านวิกฤตแรก แต่เจอวิกฤตถัดไปที่ใหญ่กว่า", pos: 25 },
            { name: "Crisis 2", nameTh: "วิกฤตที่ 2", desc: "อุปสรรคและความเสี่ยงทวีคูณ แรงกดดันสูงขึ้น", pos: 45 },
            { name: "Crisis 3", nameTh: "วิกฤตที่ 3", desc: "วิกฤตรองสุดท้ายที่ตัดทางเลือกทั้งหมดของตัวเอก", pos: 65 },
            { name: "Climax", nameTh: "ไคลแมกซ์", desc: "วิกฤตใหญ่ที่สุดรวมทุกปมมาตัดสินชะตากรรม", pos: 85 },
            { name: "Resolution", nameTh: "คลี่คลายรวดเร็ว", desc: "จบลงเร็วให้คนอ่านปรับอารมณ์และเห็นบทสรุปสั้นๆ", pos: 100 },
        ],
    },
    {
        id: "ST-009",
        nameEn: "The Heroine's Journey",
        nameTh: "การเดินทางของวีรสตรี",
        coreFocus: "Internal Healing & Psychological Integration",
        genres: ["ดราม่าจิตวิทยา", "วรรณกรรม", "โรแมนซ์ร่วมสมัย", "ศึกษาตัวละคร"],
        complexity: "High",
        description:
            "พัฒนาโดย Maureen Murdock ตอบโต้ Hero's Journey ที่เน้นความสำเร็จภายนอก เน้นภายในจิตใจ: ลูปการเยียวยาบาดแผล การปฏิเสธด้านอ่อนโยน และการผสานด้านมืด-สว่างเข้าด้วยกัน",
        positional: false,
        stages: [
            { name: "Separation from the Feminine", nameTh: "ละทิ้งด้านอ่อนโยน", desc: "ปฏิเสธด้านอารมณ์ ไปไขว่คว้าความสำเร็จในโลกเหตุผล/อำนาจ" },
            { name: "Identification with the Masculine", nameTh: "ระบุตัวกับด้านแข็งกร้าว", desc: "ประสบความสำเร็จ ได้อำนาจ ตำแหน่ง สถานะในโลกใหม่" },
            { name: "The Road of Trials", nameTh: "เส้นทางบททดสอบ", desc: "เผชิญอุปสรรค พิสูจน์ตัวตามกฎสังคมภายนอก" },
            { name: "Illusory Boon of Success", nameTh: "รางวัลลวงตา", desc: "ได้รางวัลที่ต้องการ แต่พบว่าว่างเปล่า ไม่เติมเต็มใจ" },
            { name: "Awakening & Spiritual Aridness", nameTh: "ตื่นรู้และแห้งแล้ง", desc: "หดหู่ ซึมเศร้า วิกฤตตัวตน รู้ว่าสูญเสียธรรมชาติที่แท้จริง" },
            { name: "Descent to the Goddess", nameTh: "ดิ่งสู่เทพี", desc: "จมสู่ส่วนลึกของใจเพื่อเผชิญบาดแผลในอดีต (Shadow Work)" },
            { name: "Urgent Yearning to Reconnect", nameTh: "โหยหาการเชื่อมต่อ", desc: "ต้องการอย่างแรงกล้าที่จะดึงส่วนที่เคยปฏิเสธกลับมา" },
            { name: "Healing the Mother/Daughter Split", nameTh: "เยียวยารอยร้าวแม่-ลูก", desc: "เยียวยาบาดแผลเชิงลึกทางสายเลือด/อดีต ยอมรับความอ่อนล้า" },
            { name: "Healing the Wounded Masculine", nameTh: "เยียวยาด้านแข็งที่บาดเจ็บ", desc: "ปรับความเข้าใจกับเหตุผล เห็นข้อดี-เสียของอำนาจอย่างมีสติ" },
            { name: "Integration of Opposites", nameTh: "ผสานสองด้าน", desc: "รวมเหตุผล-อารมณ์ แข็งกร้าว-อ่อนโยน เป็นมนุษย์ที่สมบูรณ์" },
        ],
    },
    {
        id: "ST-010",
        nameEn: "The Snowflake Method",
        nameTh: "ทฤษฎีเกล็ดหิมะ",
        coreFocus: "Iterative Database Expansion & Modular Architecture",
        genres: ["ซีรีส์ซับซ้อน", "แฟนตาซีมหากาพย์", "ฮาร์ดไซไฟ"],
        complexity: "High",
        description:
            "คิดค้นโดย Randy Ingermanson เป็นกระบวนการคิดพล็อตแบบ Iterative ไม่ใช่จังหวะสำเร็จรูป แต่เป็นเฟรมเวิร์กขยายข้อมูลจากแกนเล็กๆ แตกเป็นฐานข้อมูลนิยายใหญ่เหมือนผลึกเกล็ดหิมะ",
        positional: false,
        stages: [
            { name: "Step 1: One-Sentence Summary", nameTh: "สรุป 1 ประโยค", desc: "สรุปใจความนิยายทั้งเล่มใน 1 ประโยค" },
            { name: "Step 2: Full-Paragraph Expansion", nameTh: "ขยายเป็น 1 ย่อหน้า", desc: "ขยายเป็นย่อหน้า: ปูเรื่อง วิกฤต 3 จุด และตอนจบ" },
            { name: "Step 3: Character Profiles", nameTh: "ฐานข้อมูลตัวละคร", desc: "ระบุ ชื่อ เป้าหมาย ปมขัดแย้ง และจุดเปลี่ยนของตัวละครหลัก" },
            { name: "Step 4: One-Page Synopsis", nameTh: "ย่อเรื่อง 1 หน้า", desc: "ขยายแต่ละประโยคใน Step 2 เป็นเนื้อเรื่อง 1 หน้า" },
            { name: "Step 5: Character Synopses", nameTh: "ย่อเรื่องรายตัวละคร", desc: "เล่าเรื่องทั้งเล่มผ่านสายตาตัวละครแต่ละตัว เช็กความสมเหตุสมผล" },
            { name: "Step 6: Multi-Page Expansion", nameTh: "ขยาย 4-5 หน้า", desc: "ขยายโครง 1 หน้าเป็น 4-5 หน้า ระบุตรรกะและเส้นรองทั้งหมด" },
            { name: "Step 7: Master Scenes Spreadsheet", nameTh: "ตารางฉากหลัก", desc: "แปลงทุกอย่างลงตารางรายฉาก: ตัวละคร สถานที่ เป้าหมายของฉาก" },
        ],
    },
]

export const COMPLEXITY_LABEL: Record<StoryStructure["complexity"], string> = {
    Low: "ง่าย",
    Medium: "ปานกลาง",
    High: "ซับซ้อน",
}
