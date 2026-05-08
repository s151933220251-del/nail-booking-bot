require('dotenv').config();
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
};

const client = new line.messagingApi.MessagingApiClient(config);

async function deleteAllRichMenus() {
  try {
    console.log('取得所有圖文選單...');
    const richMenus = await client.getRichMenuList();
    
    console.log(`找到 ${richMenus.richmenus.length} 個圖文選單`);
    
    for (const menu of richMenus.richmenus) {
      console.log(`刪除: ${menu.richMenuId} - ${menu.name}`);
      await client.deleteRichMenu(menu.richMenuId);
      console.log('✅ 已刪除');
    }
    
    console.log('\n✅ 所有圖文選單已刪除！');
    console.log('現在可以重新建立新的選單了！');
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
}

deleteAllRichMenus();