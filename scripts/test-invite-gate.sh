#!/usr/bin/env bash
#
# ทดสอบด่านรหัสเชิญ — คนไม่มีรหัสที่ใช้ได้ต้องสมัครไม่ผ่าน
#
# flow จริง: ฟอร์มฝากรหัสไว้ใน cookie (POST /api/invite/stash) ก่อน แล้วค่อยยิง signup
# สคริปต์นี้จำลองแบบเดียวกันด้วย cookie jar ของ curl
#
# ใช้:
#   dev server ต้องรันอยู่ (npm run dev) แล้ว:
#   bash scripts/test-invite-gate.sh
#   bash scripts/test-invite-gate.sh https://your-domain.com   # ชี้ production
#
# เคส reject (ไม่มีรหัส / ผิด / หมดอายุ / ถูกเพิกถอน / ใช้ครบ) ปลอดภัย ไม่สร้าง user
# เคส accept (--create) สร้าง user จริง — รันเมื่อจงใจเท่านั้น
#
# ต้องมีแถวทดสอบเหล่านี้ในตาราง invitations ถ้าหายไปสคริปต์จะบอกเอง สร้างใหม่ด้วย:
#
#   INSERT INTO invitations (code, note, max_uses, expires_at) VALUES
#     ('EXPIRED-TEST', 'ทดสอบ: หมดอายุแล้ว', 1, now() - interval '1 day'),
#     ('REVOKED-TEST', 'ทดสอบ: ถูกเพิกถอน',  1, NULL),
#     ('USEDUP-TEST',  'ทดสอบ: ใช้ครบแล้ว',   1, NULL)
#   ON CONFLICT (code) DO NOTHING;
#   UPDATE invitations SET revoked_at = now()      WHERE code = 'REVOKED-TEST';
#   UPDATE invitations SET used_count = max_uses   WHERE code = 'USEDUP-TEST';
#
# เคส --create ใช้ MYTHORIA-OWNER ซึ่งต้องเป็นรหัสที่ยังใช้ได้

set -u
BASE="${1:-http://localhost:3000}"
CREATE="${2:-}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

# ยิง signup ผ่านด่าน: stash รหัส -> signup ด้วย cookie เดียวกัน
# ตั้งค่า global REPLY_CODE (HTTP status) และ REPLY_BODY
try_signup() {
    local code="$1" email="$2" jar="$TMP/jar"
    : > "$TMP/body"
    # ต้องส่ง Origin เหมือนเบราว์เซอร์ — better-auth เช็ค CSRF กับ request ที่พก cookie
    # ถ้าไม่ส่ง จะถูกปฏิเสธด้วย MISSING_OR_NULL_ORIGIN ก่อนถึงด่านรหัสเชิญ
    # (ได้ 403 เหมือนกันแต่คนละเหตุผล = ทดสอบไม่ได้อะไร)
    if [ -n "$code" ]; then
        curl -s -o /dev/null -c "$jar" -X POST "$BASE/api/invite/stash" \
            -H "Content-Type: application/json" -H "Origin: $BASE" \
            -d "{\"code\":\"$code\"}" 2>/dev/null
    fi
    REPLY_CODE="$(curl -s -o "$TMP/body" -w "%{http_code}" -b "$jar" -X POST "$BASE/api/auth/sign-up/email" \
        -H "Content-Type: application/json" -H "Origin: $BASE" -H "Referer: $BASE/signup" \
        -d "{\"email\":\"$email\",\"password\":\"TestPassword123\",\"name\":\"Gate Test\"}" 2>/dev/null)"
    REPLY_BODY="$(head -c 160 "$TMP/body" 2>/dev/null)"
}

# preflight: ต่อ server ติดไหม — ถ้าไม่ติดหยุดเลย ไม่งั้นผลจะหลอก
# ลองซ้ำหลายรอบ เพราะ Next dev คอมไพล์ตามต้องการ ยิงจังหวะนั้นพอดีจะต่อไม่ติดชั่วคราว
pre="000"
for _ in 1 2 3 4 5; do
    pre="$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$BASE" 2>/dev/null)"
    [ "$pre" != "000" ] && break
    sleep 2
done
if [ "$pre" = "000" ]; then
    echo "✗ ต่อ $BASE ไม่ได้ (ลอง 5 ครั้ง) — dev server รันอยู่ไหม? (npm run dev)"
    exit 2
fi

# expect_reject <label> <code> <ข้อความที่คาดว่าจะเจอใน response>
#
# เช็คข้อความเฉพาะของแต่ละเคส ไม่ใช่แค่ "ได้ 4xx ก็พอ" — เพราะ 403 มาได้จากหลายเหตุ
# (CSRF, rate limit, ด่านรหัสเชิญ) ถ้าเช็คหลวมๆ เทสต์จะเขียวโดยไม่ได้ทดสอบสิ่งที่ตั้งใจ
#
# ยังช่วยจับกรณี fixture หายด้วย: ถ้า EXPIRED-TEST ตอบ "ไม่พบรหัสเชิญนี้" แทน "หมดอายุแล้ว"
# แปลว่าแถวทดสอบถูกลบไปจากฐานข้อมูล ไม่ใช่โค้ดพัง
expect_reject() {
    local label="$1" code="$2" want="$3"
    try_signup "$code" "reject-$(date +%s%N)@example.invalid"

    case "$REPLY_BODY" in
        *MISSING_OR_NULL_ORIGIN*|*INVALID_ORIGIN*)
            echo "  ✗ $label — ถูกบล็อกที่ origin check ยังไม่ถึงด่านรหัสเชิญ"
            FAIL=$((FAIL+1)); return ;;
    esac

    if [ "$REPLY_CODE" = "000" ]; then
        echo "  ✗ $label — ต่อ endpoint ไม่ติด ทดสอบไม่ได้"
        FAIL=$((FAIL+1)); return
    fi
    if [ "$REPLY_CODE" -ge 200 ] && [ "$REPLY_CODE" -lt 300 ]; then
        echo "  ✗ $label — HTTP $REPLY_CODE ด่านรั่ว! ⚠️ มี user ถูกสร้าง"
        FAIL=$((FAIL+1)); return
    fi

    case "$REPLY_BODY" in
        *"$want"*)
            echo "  ✓ $label — HTTP $REPLY_CODE ($want)"
            PASS=$((PASS+1)) ;;
        *"ไม่พบรหัสเชิญนี้"*)
            echo "  ✗ $label — ตอบว่า 'ไม่พบรหัสเชิญ' แทน '$want'"
            echo "      → แถวทดสอบ '$code' ไม่มีในฐานข้อมูลแล้ว ดูวิธีสร้างใหม่ที่หัวไฟล์นี้"
            FAIL=$((FAIL+1)) ;;
        *)
            echo "  ✗ $label — HTTP $REPLY_CODE ไม่เจอ '$want' ใน: $REPLY_BODY"
            FAIL=$((FAIL+1)) ;;
    esac
}

echo "ทดสอบด่านรหัสเชิญที่ $BASE"
echo "── เคสที่ต้องถูกปฏิเสธ (ไม่สร้าง user) ──"
expect_reject "ไม่กรอกรหัสเลย"        ""                      "ต้องมีรหัสเชิญ"
expect_reject "รหัสมั่วไม่มีในระบบ"     "NOT-A-REAL-CODE-9999"  "ไม่พบรหัสเชิญนี้"
expect_reject "รหัสหมดอายุ"           "EXPIRED-TEST"          "หมดอายุแล้ว"
expect_reject "รหัสถูกเพิกถอน"         "REVOKED-TEST"          "ถูกยกเลิกแล้ว"
expect_reject "รหัสใช้ครบจำนวนแล้ว"    "USEDUP-TEST"           "ถูกใช้ครบจำนวนแล้ว"

echo
echo "สรุป: ผ่าน $PASS / ล้มเหลว $FAIL"

if [ "$CREATE" = "--create" ]; then
    echo
    echo "── เคส accept (สร้าง user จริง!) ──"
    email="owner-test-$(date +%s)@example.com"
    try_signup "MYTHORIA-OWNER" "$email"
    echo "  MYTHORIA-OWNER -> HTTP $REPLY_CODE ($email)"
    echo "  ⚠️ ถ้า 2xx = สร้างบัญชีจริงแล้ว ลบด้วย: DELETE FROM \"user\" WHERE email='$email';"
fi

[ "$FAIL" -eq 0 ]
