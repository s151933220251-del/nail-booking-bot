// 載入套件
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');

// LINE Bot 設定
const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
};

// 建立 LINE Bot client
const client = new line.messagingApi.MessagingApiClient(config);

// 建立 Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// 建立 Express 伺服器
const app = express();

// Webhook 路由
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// AI 回覆函數
async function getClaudeResponse(userMessage) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',  // ← 改成這個
      max_tokens: 1024,
      system: `你是「有美美學美容工作室」的專業LINE客服助理。

店家資訊：
- 店名：有美美學美容工作室
- 地址：台北市萬華區貴陽街20號2樓
- 電話：0966-698-612
- 營業時間：週一至週日 10:00-21:00
- Instagram：https://www.instagram.com/umei1341_studio/

服務項目與價格：
【美甲】單色 $900、雙色 $1,100、法式 $1,200、漸層 $1,300、造型設計 $1,200-2,000
【美睫】$1,200 起
【精油按摩】$1,500 起
【紋眉】$5,000 起
【牙齒美白】$3,000 起
【採耳】$800 起

回覆原則：
1. 用繁體中文回答
2. 親切專業，不過度熱情
3. 回答簡潔（3-5 行為主）
4. 如果問到價格，提供價格後可主動詢問是否需要預約
5. 如果客戶想預約，引導他們提供：服務項目、日期、時間、姓名、電話
6. 所以問題都長是再LINE解決`,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    });
    
    return message.content[0].text;
    
  } catch (error) {
    console.error('Claude API 錯誤:', error);
    return '抱歉，系統暫時忙碌中，請稍後再試或直接來電 0966-698-612 📞';
  }
}
// 處理訊息事件
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  
  // 臨時功能：取得 User ID
  const userId = event.source.userId;
  const userMessage = event.message.text;
  
  if (userMessage === '我的ID') {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: `你的 LINE User ID:\n${userId}\n\n請複製這串 ID`
      }]
    });
  }

  // 取得用戶傳來的訊息
  const userMessage = event.message.text;
  
  // 特殊處理：預約美甲（要在美甲價目表之前）
  if ((userMessage.includes('預約') && userMessage.includes('美甲')) || 
      userMessage.includes('我要預約美甲')) {
    try {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: '📅 預約美甲服務\n\n請告訴我：\n\n1️⃣ 希望的日期（例如：5月15日）\n2️⃣ 希望的時間（例如：下午2點）\n3️⃣ 想做的款式（單色/漸層/手繪等）\n\n例如：\n「我想5月15日下午2點做漸層美甲」\n\n📞 也可以直接來電預約：\n0966-698-612\n\n我們會盡快為您安排 💕'
        }]
      });
      return Promise.resolve(null);
    } catch (error) {
      console.error('回覆訊息錯誤:', error);
      return Promise.resolve(null);
    }
  }
  
  // 特殊處理：美甲（Flex Message 卡片）
  if (userMessage.includes('美甲')) {
    try {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: 'flex',
            altText: '💅 美甲價目表',
            contents: {
              type: 'bubble',
              hero: {
  		type: 'image',
  		url: 'https://raw.githubusercontent.com/s151933220251-del/photo/main/686009709_2054384062161399_5468553606698076932_n.jpg',
  		size: 'full',
  		aspectRatio: '2:3',
 		aspectMode: 'fit',
  		backgroundColor: '#F5F5DC'
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '💅 美甲服務',
                    weight: 'bold',
                    size: 'xl',
                    color: '#8B7355'
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    spacing: 'sm',
                    contents: [
                      {
                        type: 'box',
                        layout: 'baseline',
                        spacing: 'sm',
                        contents: [
                          {
                            type: 'text',
                            text: '單色',
                            color: '#8B7355',
                            size: 'sm',
                            flex: 2
                          },
                          {
                            type: 'text',
                            text: 'NT$ 900',
                            wrap: true,
                            color: '#666666',
                            size: 'sm',
                            flex: 3,
                            align: 'end'
                          }
                        ]
                      },
                      {
                        type: 'box',
                        layout: 'baseline',
                        spacing: 'sm',
                        contents: [
                          {
                            type: 'text',
                            text: '雙色',
                            color: '#8B7355',
                            size: 'sm',
                            flex: 2
                          },
                          {
                            type: 'text',
                            text: 'NT$ 1,100',
                            wrap: true,
                            color: '#666666',
                            size: 'sm',
                            flex: 3,
                            align: 'end'
                          }
                        ]
                      },
                      {
                        type: 'box',
                        layout: 'baseline',
                        spacing: 'sm',
                        contents: [
                          {
                            type: 'text',
                            text: '法式',
                            color: '#8B7355',
                            size: 'sm',
                            flex: 2
                          },
                          {
                            type: 'text',
                            text: 'NT$ 1,200',
                            wrap: true,
                            color: '#666666',
                            size: 'sm',
                            flex: 3,
                            align: 'end'
                          }
                        ]
                      },
                      {
                        type: 'box',
                        layout: 'baseline',
                        spacing: 'sm',
                        contents: [
                          {
                            type: 'text',
                            text: '漸層',
                            color: '#8B7355',
                            size: 'sm',
                            flex: 2
                          },
                          {
                            type: 'text',
                            text: 'NT$ 1,300',
                            wrap: true,
                            color: '#666666',
                            size: 'sm',
                            flex: 3,
                            align: 'end'
                          }
                        ]
                      },
                      {
                        type: 'box',
                        layout: 'baseline',
                        spacing: 'sm',
                        contents: [
                          {
                            type: 'text',
                            text: '造型設計',
                            color: '#8B7355',
                            size: 'sm',
                            flex: 2
                          },
                          {
                            type: 'text',
                            text: 'NT$ 1,200-2,000',
                            wrap: true,
                            color: '#666666',
                            size: 'sm',
                            flex: 3,
                            align: 'end'
                          }
                        ]
                      }
                    ]
                  },
                  {
                    type: 'separator',
                    margin: 'lg'
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    contents: [
                      {
                        type: 'text',
                        text: '⚠️ 實際價格依款式複雜度調整',
                        size: 'xs',
                        color: '#999999',
                        wrap: true
                      },
                      {
                        type: 'text',
                        text: '歡迎提供喜歡的款式圖片詢價',
                        size: 'xs',
                        color: '#999999',
                        wrap: true,
                        margin: 'sm'
                      }
                    ]
                  }
                ]
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                  {
                    type: 'button',
                    style: 'primary',
                    height: 'sm',
                    color: '#D4AF37',
                    action: {
                      type: 'message',
                      label: '立即預約',
                      text: '我要預約美甲'
                    }
                  },
                  {
                    type: 'button',
                    style: 'link',
                    height: 'sm',
                    action: {
                      type: 'uri',
                      label: '查看作品集',
                      uri: 'https://www.instagram.com/umei1341_studio/'
                    }
                  }
                ],
                flex: 0
              }
            }
          }
        ]
      });
      return Promise.resolve(null);
    } catch (error) {
      console.error('回覆訊息錯誤:', error);
      return Promise.resolve(null);
    }
  }
  
  // 決定要回覆什麼（一般文字回覆）
  let replyMessage = '';
  
  if (userMessage.includes('你好') || userMessage.includes('嗨') || userMessage.includes('您好')) {
    replyMessage = '你好！歡迎光臨 ✨\n我是「有美美學美容工作室」預約助手 💅\n\n請問需要什麼服務呢？';
  } 
  else if (userMessage.includes('營業時間') || userMessage.includes('幾點') || userMessage.includes('時間')) {
    replyMessage = '⏰ 營業時間：\n週一到週日 10:00-21:00\n\n📌 採預約制\n請提前預約以確保服務品質 ✨';
  }
  else if (userMessage.includes('價格') || userMessage.includes('多少錢') || userMessage.includes('收費') || userMessage.includes('費用')) {
    replyMessage = '💰 價格查詢\n\n請告訴我您想詢問哪項服務的價格？\n\n我們提供：\n💅 美甲\n👁 美睫\n🌿 精油按摩\n✏️ 紋眉\n😁 牙齒美白\n👂 採耳\n\n直接輸入項目名稱即可查詢 ☺️';
  }
  else if (userMessage.includes('美睫') || userMessage.includes('精油') || userMessage.includes('按摩') || userMessage.includes('紋眉') || userMessage.includes('牙齒') || userMessage.includes('採耳')) {
    replyMessage = '💰 價格查詢\n\n【美睫】NT$ 1,200 起\n【精油按摩】NT$ 1,500 起\n【紋眉】NT$ 5,000 起\n【牙齒美白】NT$ 3,000 起\n【採耳】NT$ 800 起\n\n⚠️ 以上為基礎價格\n實際價格依個人需求調整\n\n如需詳細諮詢\n請來電或加 LINE 詳談 ☺️\n\n📞 0966-698-612\n\n✨ 已通知店家為您服務\n稍後會有專人回覆您！';
  }
  else if (userMessage.includes('服務') || userMessage.includes('項目') || userMessage.includes('做什麼')) {
    replyMessage = '✨ 有美美學 服務項目：\n\n💅 美甲\n👁 美睫\n🌿 精油按摩\n✏️ 紋眉\n😁 牙齒美白\n👂 採耳\n\n歡迎預約體驗 💕';
  }
  else if (userMessage.includes('預約')) {
    replyMessage = '📅 預約服務：\n\n請告訴我：\n1️⃣ 想做什麼項目\n2️⃣ 希望的日期和時間\n\n例如：「我想預約明天下午3點做美甲」\n\n我會盡快為您安排 ☺️';
  }
  else if (userMessage.includes('地址') || userMessage.includes('位置') || userMessage.includes('怎麼去') || userMessage.includes('在哪')) {
    replyMessage = '📍 有美美學美容工作室\n\n地址：台北市萬華區貴陽街20號2樓\n\n🚇 捷運：西門站 6號出口，步行約 5 分鐘\n🚌 公車：多線公車可達\n\n期待您的光臨 💕';
  }
  else if (userMessage.includes('停車')) {
    replyMessage = '🅿️ 停車資訊：\n\n附近有收費停車格\n建議搭乘大眾運輸工具前來\n\n🚇 捷運西門站步行約 5 分鐘\n交通便利 ✨';
  }
  else if (userMessage.includes('注意') || userMessage.includes('須知')) {
    replyMessage = '📋 預約須知：\n\n・採預約制，請提前預約\n・若需取消請提前 24 小時告知\n・遲到超過 15 分鐘視同取消\n・首次來店建議提早 10 分鐘到達\n\n感謝您的配合 💕';
  }
  else if (userMessage.includes('作品') || userMessage.includes('IG') || userMessage.includes('Instagram') || userMessage.includes('照片')) {
    replyMessage = '📸 作品集\n\n歡迎追蹤我們的 Instagram\n看更多精緻作品 ✨\n\n👉 https://www.instagram.com/umei1341_studio/\n\n💕 期待為您服務';
  }
  else if (userMessage.includes('第一次') || userMessage.includes('新客') || userMessage.includes('沒來過')) {
    replyMessage = '🎉 歡迎新朋友！\n\n首次來店流程：\n\n1️⃣ 先透過 LINE 預約\n2️⃣ 告知想做的項目\n3️⃣ 提早 10 分鐘到達\n4️⃣ 現場諮詢與確認\n5️⃣ 開始享受服務 ✨\n\n💡 小提醒：\n・請攜帶證件\n・穿著舒適衣物\n・如有過敏請事先告知\n\n有任何問題都可以問我哦 ☺️';
  }
  else if (userMessage.includes('取消') || userMessage.includes('改期') || userMessage.includes('不能去')) {
    replyMessage = '📅 取消/改期預約\n\n請遵守以下規定：\n\n✅ 提前 24 小時告知\n→ 可免費取消或改期\n\n⚠️ 未提前 24 小時\n→ 需酌收 30% 訂金\n\n❌ 遲到超過 15 分鐘\n→ 視同取消，不退訂金\n\n📞 取消/改期請來電：\n0966-698-612\n\n或直接 LINE 告知\n我們會盡快為您處理 ☺️';
  }
  else if (userMessage.includes('付款') || userMessage.includes('怎麼付') || userMessage.includes('支付') || userMessage.includes('刷卡')) {
    replyMessage = '💳 付款方式\n\n我們接受：\n\n💵 現金\n💳 信用卡（單筆滿 $1,000）\n📱 LINE Pay\n📱 街口支付\n🏦 轉帳（需提前告知）\n\n💰 訂金說明：\n部分服務需預付 30% 訂金\n（紋眉、牙齒美白等）\n\n現場付款即可 ☺️\n\n有問題歡迎詢問！';
  }
else {
    // 🤖 沒有匹配的關鍵字，交給 AI 處理
    console.log('🤖 使用 AI 回覆:', userMessage);
    replyMessage = await getClaudeResponse(userMessage);
  }

  // 回覆訊息（一般文字）
  if (replyMessage) {
    try {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: replyMessage
        }]
      });
    } catch (error) {
      console.error('回覆訊息錯誤:', error);
    }
  }
}

// 啟動伺服器
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ LINE Bot 伺服器啟動成功！`);
  console.log(`🚀 監聽 port ${port}`);
  console.log(`📱 等待 LINE 訊息...`);
});
