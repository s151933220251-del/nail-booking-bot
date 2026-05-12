const line = require('@line/bot-sdk');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

// LINE Bot 設定
const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
};

const client = new line.Client(config);
const app = express();

// Anthropic API 設定
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ========== 保護系統：全域變數 ==========

// 用戶閒聊計數
const userChatCount = {};

// 已封鎖的用戶列表
const blockedUsers = [];

// 封鎖記錄（供業主查看）
const blockHistory = [];

// 業主的 LINE User ID
const OWNER_USER_ID = 'U7be81b18b26402cdb43a49fce56bc465';

// 性騷擾關鍵字（可自行擴充）
const harassmentKeywords = [
  '約炮', '一夜情', '開房', '做愛', '上床',
  '奶子', '屌', '雞雞', '鮑魚', '騷',
  '妹妹', '正妹', '辣妹', '美女', '約嗎',
  '好想要', '想幹', '想上', '半套', '全套'
];

// ========== 保護系統：檢查函數 ==========

// 檢查是否為性騷擾
function isHarassment(message) {
  const lowerMessage = message.toLowerCase();
  return harassmentKeywords.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
}

// 封鎖用戶
function blockUser(userId, reason, message) {
  if (!blockedUsers.includes(userId)) {
    blockedUsers.push(userId);
    
    blockHistory.push({
      userId: userId,
      reason: reason,
      message: message,
      timestamp: new Date().toISOString(),
      viewed: false
    });
    
    console.log(`🚫 用戶已封鎖: ${userId}, 原因: ${reason}`);
  }
}

// 檢查用戶是否已被封鎖
function isBlocked(userId) {
  return blockedUsers.includes(userId);
}

// 增加閒聊計數
function incrementChatCount(userId) {
  if (!userChatCount[userId]) {
    userChatCount[userId] = {
      count: 0,
      lastReset: Date.now()
    };
  }
  
  // 24小時重置
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  if (userChatCount[userId].lastReset < oneDayAgo) {
    userChatCount[userId].count = 0;
    userChatCount[userId].lastReset = Date.now();
  }
  
  userChatCount[userId].count++;
  
  console.log(`💬 用戶 ${userId} 閒聊計數: ${userChatCount[userId].count}/5`);
  
  return userChatCount[userId].count;
}

// ========== AI 回覆函數 ==========

async function getClaudeResponse(userMessage) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `你是「有美美學美容工作室」的專業 LINE 客服助理。

【店家資訊】
- 店名：有美美學美容工作室
- 地址：台北市萬華區貴陽街20號2樓
- 電話：0966-698-612（僅緊急情況提供）
- 營業時間：週一至週日 10:00-21:00
- Instagram：https://www.instagram.com/umei1341_studio/

【服務項目與價格】
💅 美甲：單色 $900、雙色 $1,100、法式 $1,200、漸層 $1,300、造型設計 $1,200-2,000
👁 美睫：$1,200 起
🌿 精油按摩：$1,500 起
✏️ 紋眉：$5,000 起
😁 牙齒美白：$3,000 起
👂 採耳：$800 起

【重要行為準則】
1. 所有服務都透過 LINE 處理，不要引導客戶打電話
2. 主動收集預約資訊，不要叫客戶來電預約
3. 回答要完整且有幫助，讓客戶不需要打電話就能解決問題

【閒聊偵測】
如果客戶的問題與美甲、美睫、預約、服務完全無關，在回答最前面加上「[CHAT]」標記。

無關問題包括：
- 關於 AI 本身（你幾歲、你是誰）
- 天氣、新聞、政治
- 要求聊天、說笑話、玩遊戲

【回覆風格】
- 用繁體中文
- 親切專業但不過度熱情
- 回答簡潔（3-5 行為主）
- 適度使用表情符號（💅👁🌿等）

【預約流程】
當客戶想預約時，主動詢問並收集：
1. 想做什麼服務？
2. 希望的日期？
3. 希望的時間？
4. 您的姓名？
5. 聯絡電話？

收集完畢後說：
"✅ 已為您記錄預約資訊！我們會盡快為您安排並確認時段，稍後會透過 LINE 回覆您 💕"

【絕對不要做的事】
❌ 不要說「歡迎來電」「請致電」「可以打電話」
❌ 不要提供電話號碼（除非客戶明確要求緊急聯絡方式）
❌ 不要把客戶推給電話客服
✅ 所有問題都嘗試在 LINE 解決`,
      messages: [{
        role: 'user',
        content: userMessage
      }]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Claude API 錯誤:', error);
    return '系統暫時忙碌中，請稍後再試 🙏';
  }
}

// ========== 主要處理函數 ==========

async function handleEvent(event) {
  if (event.type !== 'message') return Promise.resolve(null);
  
  const userId = event.source.userId;
  
  // ========== 業主指令處理 ==========
  
  if (userId === OWNER_USER_ID && event.message.type === 'text') {
    const userMessage = event.message.text;
    
    // 查看封鎖記錄（支援簡繁體、有無空格）
    const checkCommand = userMessage.replace(/\s/g, ''); // 移除所有空格
    
    if (checkCommand === '查看封鎖記錄' || checkCommand === '查看封鎖紀錄' || checkCommand === '封鎖記錄' || checkCommand === '封鎖紀錄') {
      const unviewedBlocks = blockHistory.filter(b => !b.viewed);
      
      if (unviewedBlocks.length === 0) {
        return client.replyMessage(event.replyToken, [{
        type: 'text',
        text: '✅ 目前沒有新的封鎖記錄'
      }]);
      }
      
      let recordText = `⚠️ 封鎖記錄（${unviewedBlocks.length} 筆未查看）\n\n`;
      
      unviewedBlocks.forEach((record, index) => {
        recordText += `${index + 1}. ${record.reason}\n`;
        recordText += `   時間：${new Date(record.timestamp).toLocaleString('zh-TW')}\n`;
        recordText += `   回覆「查看 ${index + 1}」可查看詳情\n\n`;
      });
      
      return client.replyMessage(event.replyToken, [{
        type: 'text',
        text: recordText
      }]);
    }
    
    // 查看特定記錄（支援有無空格）
    const trimmedMessage = userMessage.replace(/\s/g, ''); // 移除所有空格
    
    if (trimmedMessage.startsWith('查看') && trimmedMessage.length > 2) {
      const numberStr = trimmedMessage.replace('查看', '');
      const index = parseInt(numberStr) - 1;
      const unviewedBlocks = blockHistory.filter(b => !b.viewed);
      
      if (index >= 0 && index < unviewedBlocks.length) {
        const record = unviewedBlocks[index];
        
        let detailText = `📋 封鎖詳情\n\n`;
        detailText += `原因：${record.reason}\n`;
        detailText += `時間：${new Date(record.timestamp).toLocaleString('zh-TW')}\n`;
        detailText += `用戶 ID：${record.userId}\n\n`;
        detailText += `訊息內容：\n${record.message}\n\n`;
        detailText += `回覆「解除封鎖 ${index + 1}」可解除封鎖`;
        
        record.viewed = true;
        
       return client.replyMessage(event.replyToken, [{
          type: 'text',
          text: detailText
        }]);
      }
    }
    
    // 解除封鎖（支援有無空格）
    const unblockTrimmed = userMessage.replace(/\s/g, ''); // 移除所有空格
    
    if (unblockTrimmed.startsWith('解除封鎖') && unblockTrimmed.length > 4) {
      const numberStr = unblockTrimmed.replace('解除封鎖', '');
      const index = parseInt(numberStr) - 1;
      const record = blockHistory[index];
      
      if (record) {
        const userIndex = blockedUsers.indexOf(record.userId);
        if (userIndex > -1) {
          blockedUsers.splice(userIndex, 1);
          
          // 重置閒聊計數
          if (userChatCount[record.userId]) {
            userChatCount[record.userId].count = 0;
          }
          
          return client.replyMessage(event.replyToken, [{
          type: 'text',
          text: detailText
        }]);
        }
      }
      
      return client.replyMessage(event.replyToken, [{
        type: 'text',
        text: '❌ 找不到該封鎖記錄'
      }]);
    }
  }
  
  // ========== 一般用戶處理 ==========
  
  // 檢查是否已被封鎖
  if (isBlocked(userId)) {
    console.log(`🚫 已封鎖用戶嘗試傳訊: ${userId}`);
    return Promise.resolve(null);
  }
  
  // 只處理文字和圖片訊息
  if (event.message.type === 'image') {
    // 圖片視為不當內容，直接封鎖
    blockUser(userId, '傳送不當圖片', '[圖片訊息]');
    
    // 通知業主
    await client.pushMessage(OWNER_USER_ID, {
      type: 'text',
      text: '⚠️ 系統通知\n\n偵測到用戶傳送圖片，已自動封鎖。\n\n如需查看詳情，請回覆「查看封鎖記錄」'
    });
    
    return Promise.resolve(null);
  }
  
  if (event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  
  const userMessage = event.message.text;
  
  // 檢查性騷擾
  if (isHarassment(userMessage)) {
    blockUser(userId, '性騷擾文字', userMessage);
    
    await client.pushMessage(OWNER_USER_ID, {
      type: 'text',
      text: '⚠️ 系統通知\n\n偵測到性騷擾訊息，已自動封鎖用戶。\n\n如需查看詳情，請回覆「查看封鎖記錄」'
    });
    
    return Promise.resolve(null);
  }
  
  // ========== 特殊處理：預約美甲 Flex Message ==========
  
  if ((userMessage.includes('預約') && userMessage.includes('美甲')) || 
      userMessage.includes('我要預約美甲')) {
    
    const flexMessage = {
      type: 'flex',
      altText: '預約美甲說明',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '💅 美甲預約說明',
              weight: 'bold',
              size: 'xl',
              color: '#FF69B4'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'text',
              text: '請提供以下資訊：',
              margin: 'lg',
              weight: 'bold'
            },
            {
              type: 'text',
              text: '1️⃣ 想做的款式',
              margin: 'md'
            },
            {
              type: 'text',
              text: '2️⃣ 希望的日期和時間',
              margin: 'sm'
            },
            {
              type: 'text',
              text: '3️⃣ 您的姓名',
              margin: 'sm'
            },
            {
              type: 'text',
              text: '4️⃣ 聯絡電話',
              margin: 'sm'
            }
          ]
        }
      }
    };
    
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [flexMessage]
    });
  }
  
  // ========== 特殊處理：美甲價目表 ==========
  
  if (userMessage.includes('美甲')) {
    const flexMessage = {
      type: 'flex',
      altText: '美甲價目表',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '💅 美甲價目表',
              weight: 'bold',
              size: 'xl',
              color: '#FF69B4'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              spacing: 'sm',
              contents: [
                {
                  type: 'text',
                  text: '單色 ｜ NT$ 900',
                  size: 'md'
                },
                {
                  type: 'text',
                  text: '雙色 ｜ NT$ 1,100',
                  size: 'md'
                },
                {
                  type: 'text',
                  text: '法式 ｜ NT$ 1,200',
                  size: 'md'
                },
                {
                  type: 'text',
                  text: '漸層 ｜ NT$ 1,300',
                  size: 'md'
                },
                {
                  type: 'text',
                  text: '造型設計 ｜ NT$ 1,200-2,000',
                  size: 'md'
                }
              ]
            }
          ]
        }
      }
    };
    
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [flexMessage]
    });
  }
  
  // ========== 關鍵字回覆 ==========
  
  let replyMessage = '';
  
  if (userMessage.includes('你好') || userMessage.includes('嗨') || userMessage.includes('hi')) {
    replyMessage = '你好！歡迎光臨有美美學美容工作室 ✨\n\n我們提供：\n💅 美甲\n👁 美睫\n🌿 精油按摩\n✏️ 紋眉\n😁 牙齒美白\n👂 採耳\n\n需要了解哪項服務呢？';
  }
  else if (userMessage.includes('營業時間') || userMessage.includes('幾點開') || userMessage.includes('時間')) {
    replyMessage = '⏰ 營業時間\n\n週一至週日：10:00 - 21:00\n全年無休 ✨\n\n歡迎預約！';
  }
  else if (userMessage.includes('價格') || userMessage.includes('多少錢') || userMessage.includes('收費')) {
    replyMessage = '💰 價格查詢\n\n💅 美甲：$900 起\n👁 美睫：$1,200 起\n🌿 精油按摩：$1,500 起\n✏️ 紋眉：$5,000 起\n😁 牙齒美白：$3,000 起\n👂 採耳：$800 起\n\n想了解詳細價格，歡迎直接詢問！';
  }
  else if (userMessage.includes('地址') || userMessage.includes('位置') || userMessage.includes('在哪')) {
    replyMessage = '📍 店家位置\n\n台北市萬華區貴陽街20號2樓\n\n🚇 西門站 6 號出口，步行約 5 分鐘\n\nGoogle Maps: https://maps.app.goo.gl/xxx';
  }
  else if (userMessage.includes('預約')) {
    replyMessage = '📅 預約方式\n\n請提供以下資訊：\n1️⃣ 想做的服務\n2️⃣ 希望的日期時間\n3️⃣ 您的姓名\n4️⃣ 聯絡電話\n\n我們會盡快為您安排 💕';
  }
  else if (userMessage.includes('作品') || userMessage.includes('照片') || userMessage.includes('圖片')) {
    replyMessage = '📸 作品集\n\n歡迎追蹤我們的 Instagram 查看更多作品：\nhttps://www.instagram.com/umei1341_studio/\n\n每週都有新作品分享 ✨';
  }
  
  // ========== 基礎閒聊黑名單 ==========
  
  else {
    const chatKeywords = [
      '你好嗎', '你幾歲', '你叫什麼', '你是誰', '你是什麼',
      '說笑話', '聊天', '無聊', '陪我', '講故事',
      '天氣', '新聞', '測試', 'test', '試試',
      '玩遊戲', '唱歌', '跳舞'
    ];
    
    const isChatting = chatKeywords.some(
      keyword => userMessage.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isChatting) {
      const count = incrementChatCount(userId);
      
      if (count >= 5) {
        blockUser(userId, '閒聊超過 5 次', `最後訊息: ${userMessage}`);
        replyMessage = '很抱歉，由於您的詢問與我們的服務無關，系統已暫停您的使用權限。\n\n如有服務需求，歡迎來電：0966-698-612';
      } else {
        replyMessage = `我主要協助美甲美睫的預約和諮詢 💅\n\n如需了解服務，很樂意協助！\n\n（溫馨提醒：過多無關詢問可能影響使用權限）`;
      }
    }
    
    // ========== AI 智能回覆 ==========
    
    else {
      console.log('🤖 使用 AI 回覆:', userMessage);
      
      replyMessage = await getClaudeResponse(userMessage);
      
      // 檢查 AI 是否判斷為閒聊
      if (replyMessage.startsWith('[CHAT]')) {
        replyMessage = replyMessage.replace('[CHAT]', '').trim();
        
        const count = incrementChatCount(userId);
        
        if (count >= 5) {
          blockUser(userId, '閒聊超過 5 次（AI 判斷）', userMessage);
          replyMessage = '很抱歉，由於您的詢問與我們的服務無關，系統已暫停您的使用權限。\n\n如需協助，請稍後等待專人聯繫。';
        } else {
          replyMessage += `\n\n（提醒：請詢問服務相關問題）`;
        }
      }
    }
  }
  
  // 回覆訊息
  return client.replyMessage(event.replyToken, [{
    type: 'text',
    text: replyMessage
  }]);
}

// ========== Express 路由 ==========

app.get('/', (req, res) => {
  res.send('LINE Bot is running!');
});

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// ========== 啟動服務器 ==========

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server is running on port ${port}`);
  console.log(`🛡️ 保護系統已啟動`);
  console.log(`👤 業主 ID: ${OWNER_USER_ID}`);
});
