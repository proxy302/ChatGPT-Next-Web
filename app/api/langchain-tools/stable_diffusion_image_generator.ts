import { Tool } from "@langchain/core/tools";
import { getServerSideConfig } from "@/app/config/server";
import { dataURLtoFile } from "../utils";

export class StableDiffusionWrapper extends Tool {
  name = "stable_diffusion_image_generator";
  uploadFileUrl: string;

  constructor() {
    super();
    this.uploadFileUrl = `${
      getServerSideConfig().apiDomain
    }/gpt/api/upload/gpt/image`;
  }

  async saveImage(imageBase64: string) {
    var fileName = `${Date.now()}.png`;
    const file = dataURLtoFile(imageBase64, fileName);
    const formData = new FormData();
    formData.append("file", file);

    const filePath = await fetch(this.uploadFileUrl, {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then(async (res: any) => {
        if (res.code === 0) {
          return res.data.url;
        }
        return "";
      });

    return filePath;
  }

  /** @ignore */
  async _call(prompt: string) {
    let url = process.env.STABLE_DIFFUSION_API_URL;
    const data = {
      prompt: prompt,
      negative_prompt:
        process.env.STABLE_DIFFUSION_NEGATIVE_PROMPT ??
        "longbody, lowres, bad anatomy, bad hands, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality",
      seed: -1,
      subseed: -1,
      subseed_strength: 0,
      batch_size: 1,
      n_iter: 1,
      steps: process.env.STABLE_DIFFUSION_STEPS ?? 20,
      cfg_scale: process.env.STABLE_DIFFUSION_CFG_SCALE ?? 7,
      width: process.env.STABLE_DIFFUSION_WIDTH ?? 720,
      height: process.env.STABLE_DIFFUSION_HEIGHT ?? 720,
      restore_faces: process.env.STABLE_DIFFUSION_RESTORE_FACES ?? false,
      eta: 0,
      sampler_index: process.env.STABLE_DIFFUSION_SAMPLER_INDEX ?? "Euler a",
    };
    console.log(`[${this.name}]`, data);
    const response = await fetch(`${url}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const json = await response.json();
    let imageBase64 = json.images[0];
    if (!imageBase64) return "No image was generated";
    const filePath = await this.saveImage(imageBase64);
    console.log(`[${this.name}]`, filePath);
    return filePath;
  }

  description = `stable diffusion is an ai art generation model similar to dalle-2.
    input requires english.
    output will be the image link url.
    use markdown to display images. like: ![img](/api/file/xxx.png)`;
}
