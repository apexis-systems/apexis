import { Node } from "@tiptap/core";
import { extractYouTubeId } from "./types";

export interface VideoEmbedOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoEmbed: {
      setVideoEmbed: (attrs: { src: string; kind: "file" | "youtube"; width?: string }) => ReturnType;
    };
  }
}

/**
 * A single block node for inline video, matching the CustomImage pattern:
 * kind="file" renders <video controls>, kind="youtube" renders a responsive
 * iframe embed. All state needed to reconstruct the node lives in data-*
 * attributes on the outer wrapper (src/kind/videoId/width), so re-parsing
 * saved HTML back into the editor round-trips correctly — the youtube
 * embed src itself (youtube-nocookie.com/embed/…) isn't parseable back into
 * a video id, so the id is captured once at insert time and persisted.
 */
export const VideoEmbed = Node.create<VideoEmbedOptions>({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-src"),
        renderHTML: (attrs: Record<string, any>) => ({ "data-src": attrs.src }),
      },
      kind: {
        default: "file",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-kind") || "file",
        renderHTML: (attrs: Record<string, any>) => ({ "data-kind": attrs.kind }),
      },
      videoId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-video-id"),
        renderHTML: (attrs: Record<string, any>) => (attrs.videoId ? { "data-video-id": attrs.videoId } : {}),
      },
      width: {
        default: "100%",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-width") || "100%",
        renderHTML: (attrs: Record<string, any>) => ({ "data-width": attrs.width }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-video-embed]" }];
  },

  renderHTML({ node }) {
    const { src, kind, videoId, width } = node.attrs;
    const wrapperAttrs = {
      "data-video-embed": "",
      "data-src": src,
      "data-kind": kind,
      "data-width": width,
      ...(videoId ? { "data-video-id": videoId } : {}),
      style: `max-width: ${width}; margin-left: auto; margin-right: auto;`,
    };

    if (kind === "youtube" && videoId) {
      return [
        "div",
        wrapperAttrs,
        [
          "div",
          { style: "position: relative; padding-bottom: 56.25%; height: 0;" },
          [
            "iframe",
            {
              src: `https://www.youtube-nocookie.com/embed/${videoId}`,
              style: "position: absolute; inset: 0; width: 100%; height: 100%; border: 0;",
              allowfullscreen: "true",
            },
          ],
        ],
      ];
    }

    return ["div", wrapperAttrs, ["video", { src, controls: "true", style: "width: 100%; display: block;" }]];
  },

  addCommands() {
    return {
      setVideoEmbed:
        (attrs) =>
          ({ commands }) => {
            const videoId = attrs.kind === "youtube" ? extractYouTubeId(attrs.src) : null;
            if (attrs.kind === "youtube" && !videoId) return false;
            return commands.insertContent({ type: this.name, attrs: { ...attrs, videoId } });
          },
    };
  },
});

export default VideoEmbed;

