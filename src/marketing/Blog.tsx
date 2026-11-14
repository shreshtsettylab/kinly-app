import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from '../Link';
import NotFound from './NotFound';
import { MarketingFooter, MarketingNav } from './parts';
import { blogIndexMeta, blogPosts, formatPostDate, postTitle, readingMinutes, type Block, type BlogPost } from './blogPosts';

// Public marketing pages. They never read or write anything the app saves in this browser.
// The static copies written at build time (vite.config.ts) carry the same title and description
// for link previews; this keeps them right when someone moves between pages in place.

function usePathname() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return path;
}

const metaSelectors = {
  description: 'meta[name="description"]',
  ogTitle: 'meta[property="og:title"]',
  ogDescription: 'meta[property="og:description"]',
  ogUrl: 'meta[property="og:url"]',
  twitterTitle: 'meta[name="twitter:title"]',
  twitterDescription: 'meta[name="twitter:description"]',
  canonical: 'link[rel="canonical"]',
};

function usePageMeta(title: string, description: string, path: string) {
  useEffect(() => {
    const url = `https://www.kinly.in${path}`;
    const values: Record<keyof typeof metaSelectors, string> = { description, ogTitle: title, ogDescription: description, ogUrl: url, twitterTitle: title, twitterDescription: description, canonical: url };
    const previous: [Element, string, string | null][] = [];
    for (const [key, selector] of Object.entries(metaSelectors) as [keyof typeof metaSelectors, string][]) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const attribute = key === 'canonical' ? 'href' : 'content';
      previous.push([element, attribute, element.getAttribute(attribute)]);
      element.setAttribute(attribute, values[key]);
    }
    const previousTitle = document.title;
    document.title = title;
    return () => {
      for (const [element, attribute, value] of previous) if (value !== null) element.setAttribute(attribute, value);
      document.title = previousTitle;
    };
  }, [title, description, path]);
}

const PostMeta = ({ post }: { post: BlogPost }) => <p className="lp-blog-meta"><time dateTime={post.date}>{formatPostDate(post.date)}</time> · {readingMinutes(post)} min read</p>;

function BlogIndex() {
  usePageMeta(blogIndexMeta.title, blogIndexMeta.description, '/blog');
  return <main className="lp-blog">
    <span className="lp-tag">Blog</span>
    <h1>Notes from building Kinly</h1>
    <p className="lp-blog-lead">On friendships, the hard messages, and keeping your notes private.</p>
    <ul className="lp-blog-list">
      {blogPosts.map((post) => <li key={post.slug}>
        <Link to={`/blog/${post.slug}`} className="lp-blog-card">
          <span className="lp-mini-label">{post.label}</span>
          <h2>{post.title}</h2>
          <p>{post.summary}</p>
          <PostMeta post={post} />
        </Link>
      </li>)}
    </ul>
  </main>;
}

function BlockView({ block }: { block: Block }) {
  if (block.type === 'h2') return <h2>{block.text}</h2>;
  if (block.type === 'p') return <p>{block.text}</p>;
  const List = block.type;
  return <List>{block.items.map((item) => <li key={item}>{item}</li>)}</List>;
}

function PostPage({ post }: { post: BlogPost }) {
  usePageMeta(postTitle(post), post.description, `/blog/${post.slug}`);
  return <main className="lp-blog">
    <Link to="/blog" className="lp-blog-back">← All posts</Link>
    <article className="lp-blog-post">
      <span className="lp-tag">{post.label}</span>
      <h1>{post.title}</h1>
      <PostMeta post={post} />
      {post.body.map((block, index) => <BlockView key={index} block={block} />)}
      <p className="lp-blog-try"><Link to="/app">Try Kinly free, no sign-up <ArrowRight size={15} /></Link></p>
    </article>
  </main>;
}

export default function Blog() {
  const path = usePathname().replace(/\/+$/, '');
  const slug = path === '/blog' ? null : path.slice('/blog/'.length);
  const post = slug === null ? null : blogPosts.find((entry) => entry.slug === slug);
  const missing = slug !== null && !post;
  useEffect(() => { if (missing) document.title = 'Page not found — Kinly'; }, [missing]);
  if (missing) return <NotFound />;
  return <div className="lp lp-auth-page">
    <MarketingNav returning={false} onLanding={false} />
    {post ? <PostPage key={post.slug} post={post} /> : <BlogIndex />}
    <MarketingFooter />
  </div>;
}
