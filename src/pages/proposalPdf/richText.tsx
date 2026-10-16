import { Link, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { type RichText, textToBlocks } from "../../../config/proposal.js";
import { styles } from "./styles";

/**
 * The editor's document as PDF primitives.
 *
 * Paragraphs, headings, bullet and numbered lists, quotes, bold, italic and
 * links: the blocks and marks the CMS editor produces. Anything else (an
 * image, an embed) is dropped, the way the email does, since the PDF is the
 * agreement, not the page. Older proposals carry a plain string, which goes
 * through the same paragraph-and-bullet split the web page uses.
 */

interface Node {
  attrs?: Record<string, unknown>;
  content?: Node[];
  marks?: { attrs?: Record<string, unknown>; type: string }[];
  text?: string;
  type?: string;
}

const inline = (nodes: Node[] | undefined, prefix: string): ReactNode[] =>
  (nodes ?? []).map((n, i) => {
    const key = `${prefix}-${i}`;
    if (n.type === "hardBreak") {
      return <Text key={key}>{"\n"}</Text>;
    }
    if (typeof n.text !== "string") {
      return null;
    }
    const marks = n.marks ?? [];
    const bold = marks.some((m) => m.type === "bold");
    const italic = marks.some((m) => m.type === "italic");
    const href = marks.find((m) => m.type === "link")?.attrs?.href;
    const style = [
      ...(bold ? [styles.run] : []),
      ...(italic ? [styles.italic] : []),
    ];
    if (typeof href === "string" && href) {
      return (
        <Link key={key} src={href} style={[...style, styles.link]}>
          {n.text}
        </Link>
      );
    }
    return (
      <Text key={key} style={style}>
        {n.text}
      </Text>
    );
  });

const listItems = (
  node: Node,
  prefix: string,
  marker: (i: number) => string
): ReactNode[] =>
  (node.content ?? []).map((item, i) => (
    // Editor nodes carry no ids and the document is never reordered, so the
    // position is the identity.
    // biome-ignore lint/suspicious/noArrayIndexKey: static document
    <View key={`${prefix}-${i}`} style={styles.bullet}>
      <Text style={styles.bulletMark}>{marker(i)}</Text>
      <View style={styles.bulletText}>
        {(item.content ?? []).map((child, j) =>
          child.type === "paragraph" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: static document
            <Text key={`${prefix}-${i}-${j}`}>
              {inline(child.content, `${prefix}-${i}-${j}`)}
            </Text>
          ) : (
            block(child, `${prefix}-${i}-${j}`)
          )
        )}
      </View>
    </View>
  ));

const block = (n: Node, key: string): ReactNode => {
  switch (n.type) {
    case "paragraph":
      return (
        <Text key={key} style={styles.prose}>
          {inline(n.content, key)}
        </Text>
      );
    case "heading":
      return (
        <Text key={key} style={styles.heading}>
          {inline(n.content, key)}
        </Text>
      );
    case "bulletList":
      return (
        <View key={key} style={styles.prose}>
          {listItems(n, key, () => "•")}
        </View>
      );
    case "orderedList":
      return (
        <View key={key} style={styles.prose}>
          {listItems(n, key, (i) => `${i + 1}.`)}
        </View>
      );
    case "blockquote":
      return (
        <View key={key} style={styles.quote}>
          {(n.content ?? []).map((c, i) => block(c, `${key}-${i}`))}
        </View>
      );
    default:
      return (n.content ?? []).map((c, i) => block(c, `${key}-${i}`));
  }
};

export function PdfRichText({ value }: { value: RichText }) {
  if (typeof value !== "string") {
    return <>{(value.content as Node[]).map((n, i) => block(n, `b-${i}`))}</>;
  }
  return (
    <>
      {textToBlocks(value).map((b, i) =>
        b.kind === "list" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static document
          <View key={`s-${i}`} style={styles.prose}>
            {b.items.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static document
              <View key={`s-${i}-${j}`} style={styles.bullet}>
                <Text style={styles.bulletMark}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static document
          <Text key={`s-${i}`} style={styles.prose}>
            {b.text}
          </Text>
        )
      )}
    </>
  );
}
