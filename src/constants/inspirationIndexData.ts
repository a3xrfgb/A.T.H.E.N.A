/** Google high-res favicon helper — good default when no official asset URL. */
const fav = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;

export type InspirationIndexCard = {
  name: string;
  url: string;
  thumb: string;
};

export type InspirationIndexSection = {
  title: string;
  cards: InspirationIndexCard[];
};

const HF_LOGO =
  "https://huggingface.co/datasets/huggingface/brand-assets/resolve/0fd14cd6eca1024a487427db8d52ce5d10b3a321/hg-logo.png";
const CIVITAI_THUMB =
  "https://iconlogovector.com/uploads/images/2025/09/lg-68c7e5a8b0d03-Civitai.webp";
const MJ_SVG = "https://thesvg.org/icons/midjourney/default.svg";
const FAL_LOGO = "https://fal.ai/favicon.ico";
/** Stable SVGs from Wikimedia Commons — avoid hotlinked favicons / apple-touch (often blocked in WebView). */
const PERPLEXITY_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/1/1d/Perplexity_AI_logo.svg";
const SUNO_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/6/62/Suno_AI_icon.svg";
const RUNWAY_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/3/35/Runway_Black_Logo_SVG.svg";
const GEMINI_LOGO =
  "https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06b.png";
const ELEVEN_LOGO = "https://elevenlabs.io/favicon.ico";

export const INSPIRATION_INDEX_SECTIONS: InspirationIndexSection[] = [
  {
    title: "AI Models Hub",
    cards: [
      { name: "Hugging Face", url: "https://huggingface.co/models", thumb: HF_LOGO },
      { name: "ModelScope", url: "https://modelscope.cn/models", thumb: fav("modelscope.cn") },
      { name: "Featherless", url: "https://featherless.ai/models", thumb: fav("featherless.ai") },
      { name: "Fireworks", url: "https://fireworks.ai/models", thumb: fav("fireworks.ai") },
      { name: "Civitai", url: "https://civitai.com/models", thumb: CIVITAI_THUMB },
      { name: "Tensor.art", url: "https://tensor.art/", thumb: fav("tensor.art") },
      { name: "OpenModelDB", url: "https://openmodeldb.info/", thumb: fav("openmodeldb.info") },
      { name: "Future Tools", url: "https://futuretools.io/", thumb: fav("futuretools.io") },
      { name: "AI Bot", url: "https://ai-bot.cn/", thumb: fav("ai-bot.cn") },
    ],
  },
  {
    title: "All in One Platforms",
    cards: [
      { name: "Higgsfield", url: "https://higgsfield.ai/", thumb: fav("higgsfield.ai") },
      { name: "Artlist", url: "https://artlist.io/", thumb: fav("artlist.io") },
      { name: "fal", url: "https://fal.ai/", thumb: FAL_LOGO },
      { name: "Replicate", url: "https://replicate.com/", thumb: fav("replicate.com") },
      { name: "Krea", url: "https://www.krea.ai/", thumb: fav("krea.ai") },
      { name: "Wavespeed", url: "https://wavespeed.ai/dashboard", thumb: fav("wavespeed.ai") },
      { name: "MuAPI", url: "https://muapi.ai/playground", thumb: fav("muapi.ai") },
      { name: "Lumeflow", url: "https://www.lumeflow.ai/", thumb: fav("lumeflow.ai") },
      { name: "Leonardo.Ai", url: "https://app.leonardo.ai/", thumb: fav("leonardo.ai") },
      { name: "Pollo AI", url: "https://pollo.ai/", thumb: fav("pollo.ai") },
    ],
  },
  {
    title: "Node based Canvas Apps",
    cards: [
      { name: "Comfy Cloud", url: "https://www.comfy.org/cloud", thumb: fav("comfy.org") },
      { name: "Flora", url: "https://flora.ai/", thumb: fav("flora.ai") },
      { name: "Fuser", url: "https://fuser.studio/", thumb: fav("fuser.studio") },
      { name: "Weave", url: "https://weave.figma.com/", thumb: fav("figma.com") },
      { name: "Martini", url: "https://martini.art/", thumb: fav("martini.art") },
      { name: "Flowith", url: "https://flowith.io/", thumb: fav("flowith.io") },
    ],
  },
  {
    title: "Image Models",
    cards: [
      { name: "Midjourney", url: "https://www.midjourney.com/explore?tab=top", thumb: MJ_SVG },
      { name: "Recraft", url: "https://www.recraft.ai/community", thumb: fav("recraft.ai") },
      { name: "Reve", url: "https://app.reve.com/", thumb: fav("reve.com") },
      { name: "Imagine", url: "https://www.imagine.art/image", thumb: fav("imagine.art") },
      { name: "Ideogram", url: "https://ideogram.ai/t/explore", thumb: fav("ideogram.ai") },
      { name: "Adobe Firefly", url: "https://firefly.adobe.com/gallery", thumb: fav("adobe.com") },
      { name: "Photalabs", url: "https://www.photalabs.com/", thumb: fav("photalabs.com") },
      { name: "Lummi", url: "https://www.lummi.ai/", thumb: fav("lummi.ai") },
      { name: "Dataland", url: "https://dataland.art/", thumb: fav("dataland.art") },
      { name: "Mage", url: "https://www.mage.space/", thumb: fav("mage.space") },
      { name: "Lexica", url: "https://lexica.art/", thumb: fav("lexica.art") },
    ],
  },
  {
    title: "Video Models",
    cards: [
      { name: "Runway", url: "https://runwayml.com/", thumb: RUNWAY_LOGO },
      { name: "Kling", url: "https://kling.ai/", thumb: fav("kling.ai") },
      { name: "Hailuo AI", url: "https://hailuoai.video/", thumb: fav("hailuoai.video") },
      { name: "Luma Ray", url: "https://lumalabs.ai/ray", thumb: fav("lumalabs.ai") },
      { name: "Wan", url: "https://wan.video/", thumb: fav("wan.video") },
      { name: "LTX Studio", url: "https://ltx.studio/", thumb: fav("ltx.studio") },
      { name: "Vidu", url: "https://www.vidu.com/", thumb: fav("vidu.com") },
      { name: "PixVerse", url: "https://pixverse.ai/", thumb: fav("pixverse.ai") },
      { name: "Hedra", url: "https://www.hedra.com/", thumb: fav("hedra.com") },
      { name: "Vivago", url: "https://vivago.ai/studio", thumb: fav("vivago.ai") },
      { name: "Genmo", url: "https://www.genmo.ai/", thumb: fav("genmo.ai") },
      {
        name: "Hunyuan Video",
        url: "https://aivideo.hunyuan.tencent.com/",
        thumb: fav("tencent.com"),
      },
      { name: "Moonvalley", url: "https://www.moonvalley.com/", thumb: fav("moonvalley.com") },
      { name: "Sand AI", url: "https://sand.ai/", thumb: fav("sand.ai") },
      {
        name: "Goku",
        url: "https://saiyan-world.github.io/goku/",
        thumb: fav("github.com"),
      },
      { name: "Midjourney TV", url: "https://www.midjourney.tv/3", thumb: MJ_SVG },
      { name: "Midjourney TV", url: "https://www.midjourney.tv/", thumb: MJ_SVG },
    ],
  },
  {
    title: "Audio & Music",
    cards: [
      { name: "ElevenLabs", url: "https://elevenlabs.io/", thumb: ELEVEN_LOGO },
      { name: "Suno", url: "https://suno.com/", thumb: SUNO_LOGO },
      { name: "Udio", url: "https://www.udio.com/", thumb: fav("udio.com") },
      { name: "Producer.ai", url: "https://www.producer.ai/", thumb: fav("producer.ai") },
      { name: "MiniMax Audio", url: "https://www.minimax.io/audio", thumb: fav("minimax.io") },
      { name: "Hume", url: "https://www.hume.ai/", thumb: fav("hume.ai") },
      { name: "Sesame", url: "https://www.sesame.com/", thumb: fav("sesame.com") },
      { name: "Vapi", url: "https://vapi.ai/", thumb: fav("vapi.ai") },
      { name: "LMNT", url: "https://www.lmnt.com/", thumb: fav("lmnt.com") },
      { name: "Kyutai TTS", url: "https://kyutai.org/tts", thumb: fav("kyutai.org") },
      { name: "Fish Audio", url: "https://fish.audio/", thumb: fav("fish.audio") },
      { name: "Mureka", url: "https://www.mureka.ai/", thumb: fav("mureka.ai") },
      { name: "Ainnate TTS", url: "https://tts.ainnate.com/", thumb: fav("ainnate.com") },
    ],
  },
  {
    title: "LLMs",
    cards: [
      { name: "Claude", url: "https://claude.com/", thumb: fav("claude.com") },
      { name: "Grok", url: "https://grok.com/", thumb: fav("grok.com") },
      { name: "Gemini", url: "https://gemini.google.com/app", thumb: GEMINI_LOGO },
      { name: "Perplexity", url: "https://www.perplexity.ai/", thumb: PERPLEXITY_LOGO },
      { name: "Kimi", url: "https://www.kimi.com/", thumb: fav("kimi.com") },
      { name: "Qwen", url: "https://chat.qwen.ai/", thumb: fav("qwen.ai") },
      { name: "DeepSeek", url: "https://chat.deepseek.com/", thumb: fav("deepseek.com") },
      { name: "Le Chat Mistral", url: "https://chat.mistral.ai/chat", thumb: fav("mistral.ai") },
      { name: "Galaxy AI", url: "https://galaxy.ai/", thumb: fav("galaxy.ai") },
    ],
  },
  {
    title: "Agents",
    cards: [
      { name: "Manus", url: "https://manus.im/", thumb: fav("manus.im") },
      { name: "Genspark", url: "https://www.genspark.ai/", thumb: fav("genspark.ai") },
      { name: "Kortix", url: "https://www.kortix.com/", thumb: fav("kortix.com") },
      { name: "MiniMax Agent", url: "https://agent.minimax.io/", thumb: fav("minimax.io") },
      { name: "Kimi Agent Swarm", url: "https://www.kimi.com/agent-swarm", thumb: fav("kimi.com") },
      { name: "AI Agent", url: "https://aiagent.app/", thumb: fav("aiagent.app") },
      { name: "Glean Agents", url: "https://www.glean.com/product/ai-agents", thumb: fav("glean.com") },
      { name: "Devin", url: "https://devin.ai/", thumb: fav("devin.ai") },
      { name: "Wonda", url: "https://www.wonda.sh/?from=wondercat", thumb: fav("wonda.sh") },
    ],
  },
  {
    title: "Arena",
    cards: [
      { name: "LM Arena", url: "https://arena.ai/leaderboard/text", thumb: fav("arena.ai") },
      {
        name: "Artificial Analysis",
        url: "https://artificialanalysis.ai/",
        thumb: fav("artificialanalysis.ai"),
      },
      { name: "AI GC Arena", url: "https://aigcarena.com/", thumb: fav("aigcarena.com") },
    ],
  },
  {
    title: "Prompt Library",
    cards: [
      { name: "PromptBase", url: "https://promptbase.com/", thumb: fav("promptbase.com") },
      { name: "Prompt Llama", url: "https://prompt-llama.com/", thumb: fav("prompt-llama.com") },
      {
        name: "Prompt Library",
        url: "https://promptlibrary.org/",
        thumb: fav("promptlibrary.org"),
      },
      {
        name: "God of Prompt",
        url: "https://www.godofprompt.ai/prompt-library",
        thumb: fav("godofprompt.ai"),
      },
      {
        name: "Promptly",
        url: "https://www.promptly.fyi/library",
        thumb: fav("promptly.fyi"),
      },
    ],
  },
];
