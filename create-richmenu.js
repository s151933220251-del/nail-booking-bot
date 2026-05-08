require('dotenv').config();
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
};

const client = new line.messagingApi.MessagingApiClient(config);

// 圖文選單設定
const richMenu = {
  size: {
    width: 2500,
    height: 1686
  },
  selected: true,
  name: '有美美學選單',
  chatBarText: '點我看服務選單',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'message', text: '我要預約' }
    },
    {
      bounds: { x: 834, y: 0, width: 833, height: 843 },
      action: { type: 'message', text: '服務項目' }
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: { type: 'message', text: '營業時間' }
    },
    {
      bounds: { x: 0, y: 843, width: 833, height: 843 },
      action: { type: 'message', text: '地址' }
    },
    {
      bounds: { x: 834, y: 843, width: 833, height: 843 },
      action: { type: 'message', text: '注意事項' }
    },
    {
      bounds: { x: 1667, y: 843, width: 833, height: 843 },
      action: { type: 'uri', uri: 'tel:0966698612' }
    }
  ]
};

async function createRichMenu() {
  try {
    console.log('建立圖文選單中...');
    const response = await client.createRichMenu(richMenu);
    const richMenuId = response.richMenuId;
    
    console.log('✅ 圖文選單建立成功！');
    console.log('Rich Menu ID:', richMenuId);
    
    console.log('\n📌 重要！先上傳圖片，再設為預設！');
    console.log('步驟 1：上傳圖片');
    console.log('👉 執行：node upload-richmenu-image.js ' + richMenuId);
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
    if (error.response) {
      console.error('詳細錯誤:', error.response.data);
    }
  }
}

createRichMenu();