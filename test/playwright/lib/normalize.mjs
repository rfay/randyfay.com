// Shared HTML normalization used by BOTH the baseline-freezing script and the regression
// tests, so both sides of every comparison are cleaned identically. Any drift between two
// separate copies of this logic would show up as constant false-positive diffs.
//
// What gets stripped/masked here is grounded in what this site's actual markup contains
// (checked via curl against the development site while building this), not guessed:
//
//   - The current baseURL appears throughout absolute URLs (canonical link, CSS/JS href/src,
//     favicon, etc.). It must be neutralized so a baseline captured on randyfay.ddev.site can
//     be compared against a migration target on a completely different hostname without every
//     single page failing on the hostname alone.
//   - Backdrop's aggregated CSS/JS filenames embed a content hash
//     (css_<hash>.css / js_<hash>.js) that changes across any code/version difference even
//     when the underlying styles/scripts are equivalent — only whether an aggregate is
//     present matters here, not its exact hash.
//   - `window.Backdrop = {settings: {...}}` carries a per-cache `theme_token` and a full
//     per-request map of loaded css/js paths (`ajaxPageState`) — internal plumbing, not
//     meaningful content, and it churns on every code change.
//   - `form_build_id`/`form_token` hidden form fields are unique per page render.
//   - `<meta name="Generator" ...>` names the CMS itself, which is expected to differ (or
//     disappear entirely) across a migration and isn't part of "the content."
export function normalizeHtml(html, baseUrl) {
  let out = html;

  if (baseUrl) {
    // Normalize both the exact baseUrl and its bare-origin form, with or without a
    // trailing slash, so absolute links/hrefs collapse to one placeholder regardless of
    // how they were written.
    const origin = baseUrl.replace(/\/$/, '');
    out = out.split(origin).join('{{BASE_URL}}');
  }

  out = out.replace(/css_[A-Za-z0-9_-]+\.css/g, 'css_{{HASH}}.css');
  out = out.replace(/js_[A-Za-z0-9_-]+\.js/g, 'js_{{HASH}}.js');

  out = out.replace(
    /<script>window\.Backdrop = \{settings:.*?\};<\/script>/s,
    '<script>window.Backdrop = {{SETTINGS}};</script>'
  );
  // Older Drupal-family pages may use Drupal.settings instead.
  out = out.replace(
    /<script[^>]*>\s*jQuery\.extend\(Drupal\.settings,.*?\);\s*<\/script>/s,
    '<script>{{DRUPAL_SETTINGS}}</script>'
  );

  out = out.replace(/name="form_build_id" value="[^"]*"/g, 'name="form_build_id" value="{{TOKEN}}"');
  out = out.replace(/name="form_token" value="[^"]*"/g, 'name="form_token" value="{{TOKEN}}"');

  out = out.replace(/<meta name="Generator"[^>]*\/>/gi, '');

  return out;
}
