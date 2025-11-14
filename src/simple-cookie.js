import crypto from 'crypto';

export const carts = new Map();

function parseCookies(header) {
  const obj = {};
  if (!header) return obj;
  header.split(';').forEach((kv) => {
    const [k, v] = kv.split('=');
    if (k && v) obj[k.trim()] = decodeURIComponent(v.trim());
  });
  return obj;
}

export default function cookie() {
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie || '');
    let sid = cookies.sid;
    if (!sid) {
      sid = crypto.randomUUID();
      res.setHeader(
        'Set-Cookie',
        `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax`
      );
    }
    req.sid = sid;
    if (!carts.has(sid)) carts.set(sid, {});
    req.cart = carts.get(sid);
    req.saveCart = () => carts.set(sid, req.cart);
    next();
  };
}
