import yts from 'yt-search';
import ytdl from 'ytdl-core';
import pkg, { prepareWAMessageMedia } from '@whiskeysockets/baileys';
const { generateWAMessageFromContent, proto } = pkg;

// Use a global variable to store the topVideos and video index
const videoMap = new Map();
let videoIndex = 1; // Global index for video links

const song = async (m, Matrix) => {
  let selectedListId;
  const selectedButtonId = m?.message?.templateButtonReplyMessage?.selectedId;
  const interactiveResponseMessage = m?.message?.interactiveResponseMessage;

  if (interactiveResponseMessage) {
    const paramsJson = interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
    if (paramsJson) {
      const params = JSON.parse(paramsJson);
      selectedListId = params.id;
    }
  }

  const selectedId = selectedListId || selectedButtonId;

  const prefixMatch = m.body.match(/^[\\/!#.]/);
  const prefix = prefixMatch ? prefixMatch[0] : '/';
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();
  
  const validCommands = ['yts', 'ytsearch', 'play', 'play2'];

  if (validCommands.includes(cmd)) {
    if (!text) return m.reply('Please provide a YouTube URL or search query');

    try {
      await m.React("🕘");

      // Search YouTube for the provided query
      const searchResult = await yts(text);
      const topVideos = searchResult.videos.slice(0, 10);

      if (topVideos.length === 0) {
        m.reply('No results found.');
        await m.React("❌");
        return;
      }

      const videoButtons = topVideos.map((video, index) => {
        const uniqueId = videoIndex + index;
        videoMap.set(uniqueId, { ...video, isAudio: false });
        return {
          "header": "",
          "title": video.title,
          "description": ``,
          "id": `${uniqueId}` // Unique key format: index
        };
      });

      const audioButtons = topVideos.map((video, index) => {
        const uniqueId = videoIndex + index + topVideos.length; // Ensure unique IDs for audio buttons
        videoMap.set(uniqueId, { ...video, isAudio: true });
        return {
          "header": "",
          "title": video.title,
          "description": ``,
          "id": `${uniqueId}` // Unique key format: index
        };
      });

      const msg = generateWAMessageFromContent(m.from, {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage: proto.Message.InteractiveMessage.create({
              body: proto.Message.InteractiveMessage.Body.create({
                text: `Ethix-MD Video Downloader\n\n🔍 Search and download your favorite YouTube videos easily.\n\n🎵 Download audio or video with a single click.\n\n📌 Simply select a video from the list below to get started.`
              }),
              footer: proto.Message.InteractiveMessage.Footer.create({
                text: "© Powered By Ethix-MD"
              }),
              header: proto.Message.InteractiveMessage.Header.create({
                ...(await prepareWAMessageMedia({ image: { url: `https://uploadimage.org/i/Untitled69-2.jpg` } }, { upload: Matrix.waUploadToServer })),
                title: ``,
                gifPlayback: true,
                subtitle: "",
                hasMediaAttachment: false 
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: [
                  {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                      title: "🔖 Select a video",
                      sections: [
                        {
                          title: "😎 Top 10 YouTube Results - Videos",
                          highlight_label: "🤩 Top 10",
                          rows: videoButtons
                        },
                        {
                          title: "🎧 Select an audio",
                          highlight_label: "🎵 Top 10",
                          rows: audioButtons
                        }
                      ]
                    })
                  },
                ],
              }),
              contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                  newsletterJid: '120363222395675670@newsletter',
                  newsletterName: "Ethix-MD",
                  serverMessageId: 143
                }
              }
            }),
          },
        },
      }, {});

      await Matrix.relayMessage(msg.key.remoteJid, msg.message, {
        messageId: msg.key.id
      });
      await m.React("✅");

      // Increment the global video index for the next set of videos
      videoIndex += topVideos.length * 2; // Adjust for both video and audio buttons
    } catch (error) {
      console.error("Error processing your request:", error);
      m.reply('Error processing your request.');
      await m.React("❌");
    }
  } else if (selectedId) { // Check if selectedId exists
    const selectedVideo = videoMap.get(parseInt(selectedId)); // Find video by unique key

    if (selectedVideo) {
      try {
        const videoInfo = await ytdl.getBasicInfo(selectedVideo.videoId);
        const title = videoInfo.videoDetails.title;
        const author = videoInfo.videoDetails.author.name;
        const duration = videoInfo.videoDetails.lengthSeconds;
        const uploadDate = videoInfo.videoDetails.uploadDate;
        const videoUrl = `https://www.youtube.com/watch?v=${selectedVideo.videoId}`;
        const thumbnailUrl = selectedVideo.thumbnail; // Get the thumbnail URL from search results

        if (selectedVideo.isAudio) {
          // Download audio
          const audioStream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });
          const finalAudioBuffer = await streamToBuffer(audioStream);

          await Matrix.sendMessage(m.from, { audio: finalAudioBuffer, mimetype: 'audio/mpeg', caption: '> © Powered by Ethix-MD' }, { quoted: m });
        } else {
          // Download video
          const videoStream = ytdl(videoUrl, { filter: 'audioandvideo', quality: 'highest' });
          const finalVideoBuffer = await streamToBuffer(videoStream);

          await Matrix.sendMessage(m.from, { video: finalVideoBuffer, mimetype: 'video/mp4', caption: '> © Powered by Ethix-MD' }, { quoted: m });
        }
      } catch (error) {
        console.error("Error fetching video details:", error);
        
      }
    } else {
      
    }
  }
};

const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

export default song;
