const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs'); // مكتبة التعامل مع الملفات

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// تحديد مسار ملف حفظ البيانات
const DATA_FILE = path.join(__dirname, 'data.json');

// الحالة الافتراضية للمشروع في حال كان الملف غير موجود بعد
let state = {
  deadline: { from: '', to: '' },
  members: [],
  nextId: 1,
  projectName: 'متابعة تقدم الفريق'
};

// 1. دالة لقراءة البيانات المحفوظة عند تشغيل السيرفر
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf8');
      state = JSON.parse(fileData);
      console.log('🔹 تم تحميل بيانات الموظفين بنجاح من ملف data.json');
    } else {
      console.log('🔸 لم يتم العثور على ملف بيانات سابق، تم بدء مشروع جديد.');
    }
  } catch (err) {
    console.error('❌ خطأ في قراءة ملف البيانات:', err);
  }
}

// 2. دالة لحفظ البيانات تلقائياً عند حدوث أي تعديل
function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ خطأ أثناء حفظ البيانات:', err);
  }
}

// تشغيل دالة القراءة فور تشغيل السيرفر
loadState();

// التعديل الصحيح: جعل السيرفر يقرأ الملفات من المجلد الرئيسي مباشرة
app.use(express.static(__dirname));

wss.on('connection', (ws) => {
  // إرسال البيانات الحالية فور دخول الموظف للموقع
  ws.send(JSON.stringify({ type: 'init', state }));

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'update') {
        state = msg.state;
        
        // حفظ التعديل فوراً في الملف لضمان عدم ضياعه
        saveState();

        // بث التحديث لباقي الموظفين المتصلين
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update', state }));
          }
        });
      }
    } catch (err) {
      console.error('❌ خطأ في معالجة الرسالة المستلمة:', err);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل بأمان على الرابط: http://localhost:${PORT}`);
});
