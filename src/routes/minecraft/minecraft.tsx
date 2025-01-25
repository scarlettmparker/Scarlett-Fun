import { Accessor, Component, createEffect, createSignal, JSX, onMount } from "solid-js";
import { Application, Assets, FederatedPointerEvent, Geometry, Shader, Mesh, Ticker, BindGroup, GlProgram, GpuProgram } from "pixi.js";
import styles from './minecraft.module.css';

const BOOK_SIZE = 72;
const DEBOUNCE_MS = 300;

/**
 * Draws all parts of a player's skin onto a canvas context, including their accessories
 * 
 * @param ctx - Rendering context of the canvas.
 * @param img - Image element containing the skin texture.
 * @param skin_map - Object mapping part names to their respective skin details.
 * @param draw_accessories - Whether to draw accessory parts of the skin.
 */
function draw_all_parts(ctx: CanvasRenderingContext2D, img: HTMLImageElement, skin_map: {
  [key: string]: {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    layer?: boolean;
    mirror?: boolean
  }
}, draw_accessories: boolean) {
  const body_parts = ['body', 'arm_left', 'arm_right', 'leg_left', 'leg_right'];
  const accessory_parts = ['body_accessory', 'arm_left_accessory', 'arm_right_accessory', 'leg_left_accessory', 'leg_right_accessory'];

  body_parts.forEach(part_name => {
    draw_part(ctx, img, skin_map[part_name]);
  });

  // draw head parts separately so they render on top
  const head_parts = ['head'];
  if (draw_accessories) {
    head_parts.push('head_accessory');
    accessory_parts.forEach(part_name => {
      draw_part(ctx, img, skin_map[part_name]);
    });
  }

  head_parts.forEach(part_name => {
    draw_part(ctx, img, skin_map[part_name]);
  });
}

/**
 * Detects whether the background of the skin is predominantly black, excluding main parts.
 * 
 * @param ctx - Rendering context of the canvas.
 * @param main_parts - Main parts of the skin to exclude from the check.
 * @param width - Width of the canvas.
 * @param height - Height of the canvas.
 * @return True if the background is mostly black, false otherwise.
 */
function detect_black_background(ctx: CanvasRenderingContext2D, main_parts: {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}[], width: number, height: number): boolean {
  const image_data = ctx.getImageData(0, 0, width, height);
  const pixels = image_data.data;

  let total_pixels = 0;
  let black_pixels = 0;
  let excluded_pixels = new Set();

  for (const part of main_parts) {
    const { dx, dy, dw, dh } = part;
    for (let y = dy; y < dy + dh; y++) {
      for (let x = dx; x < dx + dw; x++) {
        excluded_pixels.add(y * width + x);
      }
    }
  }

  for (let pixel_index = 0; pixel_index < pixels.length; pixel_index += 4) {
    const x = (pixel_index / 4) % width;
    const y = Math.floor((pixel_index / 4) / width);

    if (!excluded_pixels.has(y * width + x) && y < 64 && x < 64) {
      const r = pixels[pixel_index];
      const g = pixels[pixel_index + 1];
      const b = pixels[pixel_index + 2];
      const a = pixels[pixel_index + 3];

      if (r == 0 && g == 0 && b == 0 && a == 0) {
        continue;
      }

      total_pixels++;

      if (r < 20 && g < 20 && b < 20 && a > 235) {
        black_pixels++;
      }
    }
  }

  let ratio = 1 - (black_pixels / total_pixels);
  return ratio > 0.8 && ratio != 1;
}

/**
 * Draws a specific part of the player's skin onto the canvas context.
 * 
 * @param ctx - Rendering context of the canvas.
 * @param img - Image element containing the skin texture.
 * @param part - Details of the part to be drawn, including its position and dimensions.
 */
function draw_part(ctx: CanvasRenderingContext2D, img: HTMLImageElement, part: {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  layer?: boolean;
  mirror?: boolean;
}) {
  ctx.save();
  if (part.mirror) {
    ctx.scale(-1, 1);
    part.dx = -part.dx - part.dw;
  }
  if (part.layer) {
    ctx.scale(1.1, 1.1);
    ctx.translate(-part.dw / 9, -part.dh / 10);
  }
  ctx.drawImage(img, part.sx, part.sy, part.sw, part.sh, part.dx + 2, part.dy + 16, part.dw, part.dh);
  ctx.restore();
}

/**
 * @brief Generates the mapping of each part of the player's skin.
 * 
 * @param part_width - Width multiplier for each component. Determines the horizontal scaling for each body part.
 * @param part_height - Height multiplier for each component. Controls the vertical scaling of each skin component.
 * 
 * @description This function maps each part of the player's skin using source and destination dimensions:
 * 
 * Source dimensions:
 * - `sx`: X-coordinate of the top-left corner of the part in the sprite sheet.
 * - `sy`: Y-coordinate of the top-left corner of the part in the sprite sheet.
 * - `sw`: Width of the part in the sprite sheet.
 * - `sh`: Height of the part in the sprite sheet.
 * 
 * Destination dimensions:
 * - `dx`: X-coordinate of the top-left corner for drawing the part on the canvas.
 * - `dy`: Y-coordinate of the top-left corner for drawing the part on the canvas.
 * - `dw`: Scaled width of the part on the canvas.
 * - `dh`: Scaled height of the part on the canvas.
 * 
 * Additional properties:
 * - `mirror` (optional): If true, the part will be horizontally mirrored when drawn.
 * - `layer` (optional): If true, additional transformations (scaling and translation) are applied to simulate layering.
 * 
 * @example
 * Example of pixel mapping:
 * - For the "head" part:
 *   - Source: sx = 8, sy = 8, sw = 8, sh = 8 (an 8x8 area starting at (8, 8) on the sprite sheet).
 *   - Destination: dx = part_width, dy = 0, dw = part_width * 2, dh = part_height * 2 (drawn at (part_width, 0) on the canvas, scaled by multipliers).
 * 
 * @return A mapping object where each key corresponds to a body part (e.g., "head", "body") and the value is its configuration.
 */
function get_skin_map(part_width: number, part_height: number) {
  return {
    head: {
      sx: 8,
      sy: 8,
      sw: 8,
      sh: 8,
      dx: part_width,
      dy: 0,
      dw: part_width * 2,
      dh: part_height * 2
    },
    body: {
      sx: 20,
      sy: 20,
      sw: 8,
      sh: 12,
      dx: part_width,
      dy: part_height * 2,
      dw: part_width * 2,
      dh: part_height * 3
    },
    arm_left: {
      sx: 44,
      sy: 20,
      sw: 4,
      sh: 12,
      dx: 0,
      dy: part_height * 2,
      dw: part_width,
      dh: part_height * 3
    },
    arm_right: {
      sx: 44,
      sy: 20,
      sw: 4,
      sh: 12,
      dx: part_width * 3,
      dy: part_height * 2,
      dw: part_width,
      dh: part_height * 3,
      mirror: true
    },
    leg_left: {
      sx: 4,
      sy: 20,
      sw: 4,
      sh: 12,
      dx: part_width,
      dy: part_height * 5,
      dw: part_width + 0.25,
      dh: part_height * 3
    },
    leg_right: {
      sx: 4,
      sy: 20,
      sw: 4,
      sh: 12,
      dx: part_width * 2 - 0.25,
      dy: part_height * 5,
      dw: part_width,
      dh: part_height * 3,
      mirror: true
    },
    head_accessory: {
      sx: 40,
      sy: 8,
      sw: 8,
      sh: 8,
      dx: part_width,
      dy: 0,
      dw: part_width * 2,
      dh: part_height * 2,
      layer: true
    },
    body_accessory: {
      sx: 20,
      sy: 36,
      sw: 8,
      sh: 12,
      dx: part_width,
      dy: part_height * 2,
      dw: part_width * 2,
      dh: part_height * 3,
      layer: true
    },
    arm_left_accessory: {
      sx: 60,
      sy: 52,
      sw: 4,
      sh: 12,
      dx: -4,
      dy: part_height * 2,
      dw: part_width,
      dh: part_height * 3
    },
    arm_right_accessory: {
      sx: 52,
      sy: 52,
      sw: 4,
      sh: 12,
      dx: part_width * 3,
      dy: part_height * 2,
      dw: part_width,
      dh: part_height * 3
    },
    leg_left_accessory: {
      sx: 4,
      sy: 36,
      sw: 4,
      sh: 12,
      dx: part_width - 2,
      dy: part_height * 5,
      dw: part_width,
      dh: part_height * 3,
      layer: true
    },
    leg_right_accessory: {
      sx: 4,
      sy: 52,
      sw: 4,
      sh: 12,
      dx: part_width * 2 - 4,
      dy: part_height * 5,
      dw: part_width,
      dh: part_height * 3,
      layer: true
    }
  };
}

/**
 * Helper function to load an image. This is used to load an image outside of a
 * component for use in the draw_skin function.
 * 
 * @param url URL to the image.
 * @return Promise to a HTML Image Element containing the image found from the URL.
 */
async function load_image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => resolve(img);
  })
}

function initialize_canvas_context(canvas: HTMLCanvasElement) {
  return canvas.getContext('2d') || null;
}

/**
 * Draw the players skin. This will draw the player's skin onto the canvas element,
 * using a map from the pixel data of a player's skin.
 * 
 * @canvas Canvas element to draw the skin onto.
 * @skin_url URL to the image of the skin.
 */
async function draw_skin(canvas: HTMLCanvasElement, skin_url: string = "/assets/minecraft/images/steve.png") {
  const ctx = initialize_canvas_context(canvas);
  if (!ctx) return;

  const img: HTMLImageElement = await load_image(skin_url);
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  const part_width = width / 4;
  const part_height = height / 8;
  const skin_map = get_skin_map(part_width, part_height);

  const main_parts = [
    skin_map.head, skin_map.body, skin_map.arm_left, skin_map.arm_right, skin_map.leg_left, skin_map.leg_right
  ];

  main_parts.forEach(part => {
    draw_part(ctx, img, part);
  })

  const draw_accessories = !detect_black_background(ctx, main_parts, width, height);
  draw_all_parts(ctx, img, skin_map, draw_accessories);
}

/**
 * Debounce a function by X ms. Resolves a promise to return value from
 * the function it wraps.
 * 
 * @param func Function to debounce
 * @param delay Delay of function execution (ms)
 * @return Debounced function
 */
function debounce(func: Function, delay: number) {
  let timeoutId!: ReturnType<typeof setTimeout>

  return function (this: any, ...args: any[]) {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        resolve(func.apply(this, args));
      }, delay);
    });
  }
}

/**
 * Helper function to get the skin of a Minecraft player. This endpoint returns
 * a JSON containing a base 64 object that, once decoded, contains a JSON holding
 * a link to the players skin (??? thanks Mojang).
 * 
 * @param uuid UUID of the player
 * @return JSON object containing the player skin
 */
async function get_skin(uuid: string): Promise<any> {
  try {
    const response = await fetch(`/api/session/session/minecraft/profile/${uuid}`);
    const data = await response.json();
    return data.properties;
  } catch (e) {
    console.error("Error: ", e);
    return {};
  }
}

/**
 * Helper function to get the UUID of a Minecraft player. This is used to get their
 * user information (such as skin type and skin image).
 * 
 * @param skin_username Username of the player to find.
 * @return Promise to a string of the player's UUID.
 */
async function get_uuid(skin_username: string): Promise<string> {
  try {
    const response = await fetch(`/api/mojang/users/profiles/minecraft/${skin_username}`);
    const data = await response.json();
    if (data.errorMessage) {
      return "-1";
    }

    return data.id;
  } catch {
    return "-1";
  }
}

type Skin = {
  url: string;
  type: string;
}

/**
 * Function that calls when the search bar for usernames updates.
 * It will get the skin of the user to be applied to the skin canvas.
 * 
 * @param skin_username Username of the player to draw to the canvas.
 * @returns Promise to a skin object.
 */
async function search_update(skin_username: string): Promise<Skin> {
  const uuid = await get_uuid(skin_username);
  if (uuid == "-1") {
    // return default skin if error
    return { url: "/assets/minecraft/images/steve.png", type: "normal" };
  }

  const player_data = await get_skin(uuid);
  const skin_data = JSON.parse(atob(player_data[0].value));
  const skin_url = skin_data.textures.SKIN.url;
  const skin_type = skin_data.textures.SKIN.metadata &&
    skin_data.textures.SKIN.metadata.model === "slim" ? "slim" : "normal";

  return { url: skin_url, type: skin_type };
}

/**
 * Debounce for the search update (see details above).
 * 
 * @return Promise to a skin object.
 */
const debounce_search_update = debounce(async (skin_username: string): Promise<Skin> => {
  const result = search_update(skin_username);
  return result;
}, DEBOUNCE_MS);

/**
 * Create the pixi scene. This is used for the WebGL effects displayed in the
 * book of enchanting, maybe I will add more. Wrapped in pixi_canvas_wrapper.
 */
async function create_pixi_scene() {
  // on mount ensure that re-renders occur
  const old_wrapper = document.getElementById('pixi_canvas_wrapper')
  if (old_wrapper) {
    return;
  }

  // create wrapper for custom styling
  const wrapper = document.createElement('div');
  wrapper.id = 'pixi_canvas_wrapper';
  wrapper.classList.add(styles.pixi_canvas_wrapper);

  const app = new Application();
  await app.init({ backgroundAlpha: 0, resizeTo: window, preference: 'webgl' });

  wrapper.appendChild(app.canvas);
  document.body.appendChild(wrapper);

  const book_texture = await Assets.load('/assets/minecraft/images/book.png');

  const book_geometry = new Geometry({
    attributes: {
      aPosition: [
        -0.5, -0.5,
        0.5, -0.5,
        0.5, 0.5,
        -0.5, 0.5
      ],
      aUV: [
        0, 0,
        1, 0,
        1, 1,
        0, 1
      ],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });

  const vertex_shader = `
    in vec2 aPosition;
    in vec2 aUV;
    out vec2 vUV;

    uniform mat3 uProjectionMatrix;
    uniform mat3 uWorldTransformMatrix;
    uniform mat3 uTransformMatrix;

    void main() {
      mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
      gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
      vUV = aUV;
    }
  `;

  const glow_fragment_shader = `
    #version 300 es\n
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uOpacity;
    in vec2 vUV;
    out vec4 fragColor;

    // perlin noise function
    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
      return mod289(((x*34.0)+1.0)*x);
    }

    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      vec3 ns = 1.0/7.0 * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm0 = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm0.x;
      p1 *= norm0.y;
      p2 *= norm0.z;
      p3 *= norm0.w;

      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }

    void main() {
      vec4 baseColor = texture(uTexture, vUV);

      // calculate Perlin noise
      float noise = snoise(vec3(vUV * 3.0, uTime * 1.5));
      vec3 overlayColor = vec3(0.25 * uOpacity, 0.05 * uOpacity, 0.6 * uOpacity) * (noise + 0.5);

      vec4 finalColor;
      for (int i = 0; i < 3; i++) {
        finalColor[i] = 1.0 - (1.0 - baseColor[i]  * uOpacity) * (1.0 - overlayColor[i]);
      }
      finalColor.a = baseColor.a * 0.7 * uOpacity;

      vec3 edgeGlow = vec3(0.05 * uOpacity, 0.03 * uOpacity, 0.4 * uOpacity);
      if (baseColor.a > 0.9) {
        finalColor.rgb += edgeGlow.rgb;
      }

      // pulsating pink overlay
      float pulsate = 0.5 + 0.5 * sin(0.5);
      vec4 pulsatingOverlay = vec4(1.0 * uOpacity, 0.2 * uOpacity, 0.8 * uOpacity, 0.2 * uOpacity) * pulsate;

      finalColor.rgb += pulsatingOverlay.rgb * 0.2 * uOpacity;
      finalColor = mix(finalColor, pulsatingOverlay, pulsatingOverlay.a);

      finalColor.a *= 0.5;
      if (finalColor.a < 0.1) {
        discard;
      }
      fragColor = finalColor;
    }
  `

  const glow_shader_glprogram = new GlProgram({
    vertex: vertex_shader,
    fragment: glow_fragment_shader
  })

  const glow_shader = new Shader({
    glProgram: glow_shader_glprogram,
    resources: {
      timeUniforms: {
        uTime: {
          value: 0.0,
          type: 'f32'
        }
      },
      opacityUniforms: {
        uOpacity: {
          value: 0.0,
          type: 'f32'
        }
      },
      uTexture: book_texture.source,
    },
  });

  const book = new Mesh({
    geometry: book_geometry,
    shader: glow_shader
  })

  book.interactive = true;
  book.width = BOOK_SIZE;
  book.height = BOOK_SIZE;

  window.addEventListener('resize', () => move_book(book));
  window.addEventListener('scroll', () => move_book(book));
  move_book(book); // on init

  book.onmousemove = function (event) {
    create_particles(event, book)
  }

  let fade_interval: NodeJS.Timeout;

  const FADE_TIME = 16;
  const FADE_STEP = 0.04;
  
  function fade_in() {
    clearInterval(fade_interval);

    fade_interval = setInterval(() => {
      if (glow_shader.resources.opacityUniforms.uniforms.uOpacity < 1.0) {
        glow_shader.resources.opacityUniforms.uniforms.uOpacity += FADE_STEP;
      } else {
        clearInterval(fade_interval);
      }
    }, FADE_TIME);
  }
  
  function fade_out() {
    clearInterval(fade_interval);
    
    fade_interval = setInterval(() => {
      if (glow_shader.resources.opacityUniforms.uniforms.uOpacity >= 0.0) {
        glow_shader.resources.opacityUniforms.uniforms.uOpacity -= FADE_STEP;
      } else {
        clearInterval(fade_interval);
      }
    }, FADE_TIME);
  }
  
  book.onmouseover = function () {
    fade_in();
  }
  
  book.onmouseleave = function () {
    fade_out();
  }

  app.stage.addChild(book);
  app.ticker.add(() => {
    glow_shader.resources.timeUniforms.uniforms.uTime += 0.01;
  })
}

/**
 * Move the fake (enchanting) book element to the position of the real book.
 * 
 * @param book PixiJS book mesh.
 */
function move_book(book: Mesh<Geometry, Shader>) {
  let real_book!: HTMLImageElement;
  real_book = document.getElementById("real_book") as HTMLImageElement;

  const rect = real_book.getBoundingClientRect();
  book.x = rect.x + (rect.width / 2);
  book.y = rect.y + (rect.height / 2);
}

/**
 * Animate particles when hovering over the book.
 */
function create_particles(event: FederatedPointerEvent, book: Mesh<Geometry, Shader>) {

}


/**
 * Main component for the Minecraft page. Contains the Secret Life component,
 * the background component and the Pixi.JS context.
 * 
 * @return JSX Component of the Minecraft page.
 */
const Minecraft: Component = () => {
  return (
    <>
      <SecretLife>
      </SecretLife>
      <Background>
        <></>
      </Background>
    </>
  )
};

/**
 * Main Secret Life component. Contains all the information and skin processing,
 * but does not deal with any Pixi.JS stuff.
 * 
 * @return JSX Component for the Secret Life page.
 */
const SecretLife: Component = () => {
  const [skin_username, set_skin_username] = createSignal("");
  const [skin, set_skin] = createSignal<Skin>({
    url: "/assets/minecraft/images/steve.png", type: "normal"
  });
  const [canvas_ref, set_canvas_ref] = createSignal<HTMLCanvasElement | null>(null)

  createEffect(() => {
    if (!canvas_ref()) return;
    draw_skin(canvas_ref()!, skin().url);
  })

  createEffect(() => {
    if (!skin_username()) return;
    const url = debounce_search_update(skin_username());

    url.then((result) => {
      set_skin(result as Skin);
    })
  })

  return (
    <div class={styles.wrapper}>
      <span class={styles.title}>
        Secret Life
        <span class={styles.sub_header}>
          Tue 4 Jun - Tue 16 Jul
        </span>
      </span>
      <div class={styles.life_wrapper}>
        <div class={styles.info_wrapper}>
          <div class={styles.info}>
            <p>
              Secret Life was a 7 week long Minecraft event hosted for students at the University of Exeter, running once a week with 30 active players a session.
            </p>
            <p>
              In Secret Life, players are assigned a task at the start of every session that they complete as discretely as possible.
            </p>
            <p>
              Across the 7 sessions, over 250 tasks were written and distributed. Tasks usually involve doing something social, which helps bring players together.
            </p>
            <button class={styles.more}>
              Read More
            </button>
          </div>
          <div class={styles.info}>
            <button class={styles.more}>
              Read More
            </button>
          </div>
        </div>
        <Character
          canvas_ref={(el) => (set_canvas_ref(el))}
          skin_username={skin_username}
          set_skin_username={set_skin_username}>
        </Character>
      </div>
    </div>
  )
}

interface CharacterProps {
  canvas_ref: (el: HTMLCanvasElement | null) => void;
  skin_username: Accessor<string>;
  set_skin_username: (skin_username: string) => void;
}

/**
 * Character component mapping the Minecraft character sprite to 2D space.
 * 
 * @param canvas_ref Callback function for the reference to the canvas.
 * @param skin_username Accessor of the username of the player's skin to map.
 * @param set_skin_username Setter for the username of the player.
 * 
 * @return JSX Component of the Minecraft character.
 */
const Character: Component<CharacterProps> = (props) => {
  return (
    <div class={styles.character_wrapper}>
      <img class={styles.book} src="/assets/minecraft/images/book.png" alt="book"
        id="real_book" width={BOOK_SIZE} height={BOOK_SIZE} draggable={false}>
      </img>
      <canvas class={styles.canvas} ref={props.canvas_ref} width={161} height={323}>
      </canvas>
      {/* i hate html stupid oninput instead of onchange */}
      <input class={styles.input} placeholder={"Enter a username..."} value={props.skin_username()}
        oninput={(e) => { props.set_skin_username(e.target.value) }} spellcheck={false}>
      </input>
    </div>
  )
}

interface BackgroundProps {
  children: JSX.Element;
}

/**
 * Background wrapper to set the background image of the page.
 * 
 * @param children Any children found within the wrapper.
 * 
 * @return JSX Component of the background wrapper.
 */
const Background: Component<BackgroundProps> = (props) => {
  onMount(() => {
    create_pixi_scene();
  })

  return (
    <div class={styles.background}>
      {props.children}
    </div>
  )
}

export default Minecraft;