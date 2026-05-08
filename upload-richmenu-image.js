require('dotenv').config();
const fs = require('fs');
const https = require('https');
const line = require('@line/bot-sdk');

const richMenuId = process.argv[2];

if (!richMenuId) {
  console.log('❌ 請提供 Rich Menu ID');
  console.log('用法: node upload-richmenu-image.js <richMenuId>');
  process.exit(1);
}

const imageData = fs.readFileSync('./richmenu.png');

const options = {
  hostname: 'api-data.line.me',
  port: 443,
  path: `/v2/bot/richmenu/${richMenuId}/content`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'image/png',
    'Content-Length': imageData.length
  }
};

console.log('上傳圖片中...');

const req = https.request(options, async (res) => {
  console.log('狀態碼:', res.statusCode);
  
  if (res.statusCode === 200) {
    console.log('✅ 圖片上傳成功！');
    
    // 設為預設選單
    try {
      const config = {
        channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
      };
      const client = new line.messagingApi.MessagingApiClient(config);
      
      console.log('設定為預設選單中...');
      await client.setDefaultRichMenu(richMenuId);
      console.log('✅ 已設為預設選單！');
      console.log('✅ 圖文選單完成！');
      console.log('\n📱 現在打開手機 LINE，應該可以看到選單了！');
    } catch (error) {
      console.error('❌ 設定預設選單失敗:', error);
    }
  } else {
    console.log('❌ 上傳失敗');
  }
  
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error('❌ 錯誤:', e);
});

req.write(imageData);
req.end();