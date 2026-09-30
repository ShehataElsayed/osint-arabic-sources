const $ = (id) => document.getElementById(id);
const g = (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q);
const bing = (q) => 'https://www.bing.com/search?q=' + encodeURIComponent(q);
const ddg = (q) => 'https://duckduckgo.com/?q=' + encodeURIComponent(q);

const KINDS = {
  person: { label: 'شخص', fields: [
    ['name', 'الاسم الكامل', 'مثال: محمد أحمد علي', true],
    ['org', 'جهة العمل أو الصفة', 'اختياري'],
    ['city', 'المدينة أو البلد', 'اختياري'],
    ['extra', 'كلمات مفتاحية إضافية', 'اختياري'],
    ['exclude', 'استبعاد كلمات (مفصولة بمسافات)', 'اختياري'],
    ['from', 'من تاريخ (اختياري)', '', false, 'date'],
    ['to', 'إلى تاريخ (اختياري)', '', false, 'date'],
  ]},
  username: { label: 'اسم مستخدم أو حساب', fields: [
    ['handle', 'اسم المستخدم بدون @', 'username', true],
  ]},
  email: { label: 'بريد إلكتروني', fields: [
    ['email', 'البريد الإلكتروني', 'name@example.com', true],
  ]},
  phone: { label: 'رقم هاتف', fields: [
    ['phone', 'الرقم بالصيغة الدولية', '+2010XXXXXXXX', true],
  ]},
  domain: { label: 'نطاق أو موقع', fields: [
    ['domain', 'النطاق', 'example.com', true],
  ]},
  image: { label: 'صورة', fields: [
    ['imageurl', 'رابط الصورة إن وُجد (اختياري)', 'https://…'],
  ]},
  topic: { label: 'موضوع أو حدث عام', fields: [
    ['topic', 'الكلمات المفتاحية للموضوع', 'مثال: تصدير القمح', true],
    ['city', 'المكان (اختياري)', ''],
    ['exclude', 'استبعاد كلمات (اختياري)', ''],
    ['from', 'من تاريخ (اختياري)', '', false, 'date'],
    ['to', 'إلى تاريخ (اختياري)', '', false, 'date'],
  ]},
};

function renderFields() {
  const kind = $('kind').value;
  const box = $('fields');
  box.innerHTML = '';
  for (const [id, label, ph, req, type] of KINDS[kind].fields) {
    const l = document.createElement('label');
    l.textContent = label + (req ? ' *' : '');
    const inp = document.createElement('input');
    inp.id = 'f_' + id;
    inp.type = type || 'text';
    if (ph) inp.placeholder = ph;
    inp.dir = (id === 'email' || id === 'domain' || id === 'handle' || id === 'phone' || id === 'imageurl') ? 'ltr' : 'rtl';
    l.appendChild(inp);
    box.appendChild(l);
  }
}
$('kind').addEventListener('change', renderFields);
renderFields();

const val = (id) => { const e = $('f_' + id); return e ? e.value.trim() : ''; };
const q = (s) => '"' + s.replace(/"/g, '') + '"';
const excl = (s) => s ? ' ' + s.split(/\s+/).map(w => '-' + w).join(' ') : '';
const dates = (v) => (v.from ? ' after:' + v.from : '') + (v.to ? ' before:' + v.to : '');
const it = (cmd, open) => ({ cmd, open: open || g(cmd) });
const link = (label, url) => ({ cmd: label, open: url });

function stagesFor(kind, v) {
  const S = [];
  const intro1 = 'ابدأ بأوسع بحث ممكن ثم ضيّق تدريجيًا. جرّب كل أمر في جوجل أولًا، وأعد تجربته في بينج وDuckDuckGo لأن نتائجها تختلف.';
  if (kind === 'person') {
    const n = q(v.name), base = n + (v.org ? ' ' + q(v.org) : '');
    const gen = [ it(n + dates(v)), it(base + (v.city ? ' ' + q(v.city) : '') + excl(v.exclude) + dates(v)) ];
    if (v.extra) gen.push(it(n + ' ' + v.extra + dates(v)));
    gen.push(it(n + ' filetype:pdf'), it(n + ' (intitle:"سيرة ذاتية" OR inurl:cv OR intext:resume)'), it(n + ' (حكم OR قضية OR محكمة OR دعوى)'));
    S.push({ t: 'المرحلة ١ — البحث العام', intro: intro1, items: gen });
    S.push({ t: 'المرحلة ٢ — المنصات والشبكات', intro: 'ابحث عن الاسم داخل كل منصة على حدة؛ كل منصة تفهرس أجزاء مختلفة من ملفات مستخدميها.', items: [
      it(n + ' site:linkedin.com'), it(n + ' site:facebook.com'), it(n + ' site:x.com OR site:twitter.com'),
      it(n + ' site:instagram.com OR site:tiktok.com'), it(n + ' site:youtube.com'), it(n + ' site:t.me OR site:telegram.me'),
      it(n + ' site:github.com OR site:stackoverflow.com') ]});
    S.push({ t: 'المرحلة ٣ — التوسع والربط', intro: 'من كل نتيجة، التقط مفاتيح جديدة (لقب عائلة، مدينة، جهة عمل) وأعد تدويرها في الأوامر السابقة. ابحث في الأرشيف عن نسخ قديمة من الصفحات.', items: [
      link('البحث في أرشيف الويب عن الاسم والروابط القديمة', 'https://web.archive.org/'),
      link('البحث في الصور باسم الشخص (جوجل صور)', 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(v.name)),
      link('خريطة المصادر: سجلات المحاكم والسجلات الرسمية', './index.html#tree') ]});
  } else if (kind === 'username') {
    const u = v.handle.replace(/^@/, '');
    S.push({ t: 'المرحلة ١ — أين يظهر هذا الاسم؟', intro: 'افتح الملفات المباشرة أولًا، ثم ابحث عن اسم المستخدم في محركات البحث لاكتشاف منصات أخرى يستخدمها بنفس الاسم.', items: [
      link('إكس (تويتر)', 'https://x.com/' + u), link('إنستجرام', 'https://www.instagram.com/' + u),
      link('فيسبوك', 'https://www.facebook.com/' + u), link('تيك توك', 'https://www.tiktok.com/@' + u),
      link('تيليجرام', 'https://t.me/' + u), link('جيت هب', 'https://github.com/' + u),
      link('يوتيوب', 'https://www.youtube.com/@' + u), link('ريديت', 'https://www.reddit.com/user/' + u) ]});
    S.push({ t: 'المرحلة ٢ — تتبع الاسم عبر الإنترنت', intro: 'نفس اسم المستخدم غالبًا يتكرر في منصات كثيرة. استخدم أدوات فحص الأسماء ومحركات البحث معًا.', items: [
      it(q(u) + ' -site:x.com -site:instagram.com -site:facebook.com'),
      it(q(u) + ' site:linkedin.com'), it(q(u) + ' filetype:pdf'),
      link('WhatsMyName — فحص الاسم في مئات المواقع', 'https://whatsmyname.app/'),
      link('Namechk — فحص توفر/استخدام الاسم', 'https://namechk.com/') ]});
    S.push({ t: 'المرحلة ٣ — الأرشيف والتاريخ', intro: 'الحسابات تُحذف لكن الأرشيف يتذكر. ابحث عن نسخ محفوظة من صفحات الحساب.', items: [
      link('نسخ أرشيف الويب من حساب إكس', 'https://web.archive.org/web/*/https://x.com/' + u),
      link('نسخ أرشيف الويب من إنستجرام', 'https://web.archive.org/web/*/https://www.instagram.com/' + u),
      link('نسخ أرشيف الويب من فيسبوك', 'https://web.archive.org/web/*/https://www.facebook.com/' + u) ]});
  } else if (kind === 'email') {
    const e = v.email;
    S.push({ t: 'المرحلة ١ — أين ظهر هذا البريد علنًا؟', intro: intro1, items: [
      it(q(e)), it(q(e) + ' filetype:pdf OR filetype:xlsx OR filetype:csv OR filetype:docx'),
      it(q(e) + ' site:linkedin.com'), it(q(e) + ' site:facebook.com'), it(q(e) + ' site:github.com') ]});
    S.push({ t: 'المرحلة ٢ — ماذا يرتبط بهذا البريد؟', intro: 'أدوات فحص البريد تكشف الحسابات المرتبطة به في بعض المنصات، وخدمات كشف التسريبات تخبرك إن ظهر في تسريبات منشورة. استخدم النتائج كمؤشرات تحتاج تحققًا، لا كأدلة نهائية.', items: [
      link('Epieos — حسابات مرتبطة بالبريد', 'https://epieos.com/'),
      link('Have I Been Pwned — فحص التسريبات', 'https://haveibeenpwned.com/'),
      link('أرشيف الويب: صفحات ذكرت البريد', 'https://web.archive.org/web/*/' + e) ]});
  } else if (kind === 'phone') {
    const p = v.phone.replace(/[\s-]/g, '');
    const intl = p.replace(/^\+/, '');
    const variants = [it(q(p)), it(q(intl))];
    if (intl.startsWith('20')) variants.push(it(q('0' + intl.slice(2))));
    variants.push(it(q(p) + ' filetype:pdf OR filetype:xlsx OR filetype:csv'), it(q(p) + ' site:facebook.com'));
    S.push({ t: 'المرحلة ١ — أين ظهر هذا الرقم علنًا؟', intro: 'جرّب الصيغ المختلفة للرقم: بالكود الدولي، وبدونه. أرقام الهواتف تظهر في إعلانات وفواتير وملفات منشورة.', items: variants });
    S.push({ t: 'المرحلة ٢ — ماذا يرتبط بالرقم؟', intro: 'تطبيقات المراسلة والدليل العكسي تعطي مؤشرات أولية عن صاحب الرقم. تعامل معها كمؤشرات تحتاج تحققًا مستقلًا.', items: [
      link('فتح محادثة واتساب مع الرقم (يظهر الاسم والصورة العلنية)', 'https://wa.me/' + intl),
      link('Truecaller — الدليل العكسي للأرقام', 'https://www.truecaller.com/'),
      it(q(p) + ' (واتساب OR تيليجرام OR "اتصل بنا")') ]});
  } else if (kind === 'domain') {
    const d = v.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    S.push({ t: 'المرحلة ١ — ماذا ينشر الموقع؟', intro: 'اكشف ما فهرسته محركات البحث من الموقع: الصفحات، الملفات، ولوحات الدخول الظاهرة للعامة.', items: [
      it('site:' + d), it('site:' + d + ' filetype:pdf OR filetype:xlsx OR filetype:docx OR filetype:csv'),
      it('site:' + d + ' intitle:"index of"'), it('site:' + d + ' inurl:admin OR inurl:login OR inurl:upload'),
      it(q(d) + ' -site:' + d) ]});
    S.push({ t: 'المرحلة ٢ — من يقف خلف الموقع؟', intro: 'سجلات النطاق والشهادات والبنية التقنية تكشف المالك والاستضافة والنطاقات الشقيقة.', items: [
      link('WHOIS — سجل ملكية النطاق', 'https://who.is/whois/' + d),
      link('crt.sh — شهادات TLS والنطاقات الفرعية', 'https://crt.sh/?q=%25.' + d),
      link('DNSDumpster — خريطة النطاق والخوادم', 'https://dnsdumpster.com/'),
      link('BuiltWith — التقنيات المستخدمة', 'https://builtwith.com/' + d),
      link('urlscan — فحوصات سابقة للموقع', 'https://urlscan.io/search/#' + d) ]});
    S.push({ t: 'المرحلة ٣ — تاريخ الموقع', intro: 'كيف كان الموقع يبدو سابقًا؟ الأرشيف يكشف صفحات حُذفت وملكيات تغيرت.', items: [
      link('كل النسخ المؤرشفة من الموقع', 'https://web.archive.org/web/*/' + d),
      link('أرشفة النسخة الحالية الآن', 'https://web.archive.org/save/https://' + d) ]});
  } else if (kind === 'image') {
    const items = [
      link('Google Lens — بحث عكسي بالصورة', 'https://lens.google.com/'),
      link('Yandex Images — قوي في الوجوه والأماكن', 'https://yandex.com/images/'),
      link('TinEye — بحث عكسي وتاريخ ظهور الصورة', 'https://tineye.com/') ];
    if (v.imageurl) {
      items.push(link('TinEye مباشرة على رابط صورتك', 'https://tineye.com/search?url=' + encodeURIComponent(v.imageurl)));
      items.push(link('Google Lens مباشرة على رابط صورتك', 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(v.imageurl)));
    }
    S.push({ t: 'المرحلة ١ — البحث العكسي', intro: 'ارفع الصورة أو الصق رابطها في أكثر من محرك؛ كل محرك يغطي مصادر مختلفة. قارن النتائج ولا تعتمد على محرك واحد.', items });
    S.push({ t: 'المرحلة ٢ — التحقق من الصورة', intro: 'بعد إيجاد أقدم ظهور للصورة، تحقق من مكانها وزمانها باتباع مسار التحقق المخصص للصور.', items: [
      link('مسار التحقق من صورة — خطوة بخطوة مع سجل أدلة', './verification.html') ]});
  } else if (kind === 'topic') {
    const t = q(v.topic), place = v.city ? ' ' + q(v.city) : '';
    S.push({ t: 'المرحلة ١ — البحث العام', intro: intro1, items: [
      it(t + place + excl(v.exclude) + dates(v)),
      it(t + place + ' (تقرير OR دراسة OR بيانات) filetype:pdf' + dates(v)),
      it(t + place + ' site:gov.eg OR site:gov.sa OR site:gov.ae OR site:un.org' + dates(v)),
      it(t + ' (حصري OR تحقيق OR كشف)' + dates(v)) ]});
    S.push({ t: 'المرحلة ٢ — الأخبار والمنصات', intro: 'تتبع تطور الموضوع في الأخبار والشبكات معًا؛ الشبكات تسبق الأخبار غالبًا لكنها تحتاج تحققًا أشد.', items: [
      link('أخبار جوجل', 'https://news.google.com/search?q=' + encodeURIComponent(v.topic)),
      link('بحث إكس المباشر', 'https://x.com/search?q=' + encodeURIComponent(v.topic + (v.from ? ' since:' + v.from : '') + (v.to ? ' until:' + v.to : '')) + '&f=live'),
      link('يوتيوب', 'https://www.youtube.com/results?search_query=' + encodeURIComponent(v.topic)),
      link('فيسبوك — منشورات عامة', 'https://www.facebook.com/search/posts/?q=' + encodeURIComponent(v.topic)) ]});
    S.push({ t: 'المرحلة ٣ — البيانات والوثائق', intro: 'ابحث عن المصادر الأولية: البيانات المفتوحة والوثائق الرسمية والتقارير، لا الروايات المنقولة عنها.', items: [
      it(t + ' filetype:xlsx OR filetype:csv'),
      it(t + ' site:data.gov.eg OR site:capmas.gov.eg'),
      link('خريطة المصادر: البيانات المفتوحة والسجلات الرسمية', './index.html#tree') ]});
  }
  S.push({ t: 'المرحلة الأخيرة — التوثيق قبل فوات الأوان', intro: 'كل ما تجده اليوم قد يُحذف غدًا. أرشف الروابط المهمة فورًا، وسجّل كل دليل برابطه وتاريخ وصولك إليه، ثم تحقق منه بمصدرين مستقلين قبل الاعتماد عليه.', items: [
    link('أرشفة رابط في أرشيف الويب الآن', 'https://web.archive.org/save/'),
    link('فتح سجل التحقق التفاعلي لتوثيق أدلتك', './verification.html'),
    link('مراجعة خارطة المنهجية كاملة', './methodology.html') ]});
  return S;
}

function planText(kind, v) {
  const names = { person: () => v.name, username: () => '@' + v.handle.replace(/^@/, ''), email: () => v.email, phone: () => v.phone, domain: () => v.domain, image: () => 'الصورة محل التحقيق', topic: () => v.topic };
  const target = names[kind] ? names[kind]() : '';
  let extra = '';
  if (kind === 'person') extra = 'ابدأ بإثبات الهوية (اسم، صورة، انتماء)، ثم وسّع إلى العلاقات والأنشطة العامة، وتوقف عند حدود المصلحة العامة.';
  if (kind === 'username') extra = 'أثبت أولًا أن الحسابات التي تحمل الاسم نفسه تعود للشخص نفسه (صورة، لغة، توقيت، علاقات) قبل أي ربط.';
  if (kind === 'email' || kind === 'phone') extra = 'كل مؤشر تجمعه يحتاج تأكيدًا من مصدر ثانٍ قبل نسبته لشخص بعينه.';
  if (kind === 'domain') extra = 'اجمع ما ينشره الموقع نفسه، ثم من يقف خلفه، ثم تاريخه؛ قارن النسخ القديمة بالحالية.';
  if (kind === 'image') extra = 'الهدف: أقدم ظهور موثق للصورة، ومكانها، وزمانها. لا تبنِ استنتاجًا على مطابقة واحدة.';
  if (kind === 'topic') extra = 'حدد ثلاثة أسئلة فرعية قابلة للإجابة من مصادر أولية، وابدأ بالوثائق لا بالروايات.';
  return 'الهدف: جمع مؤشرات مفتوحة المصدر عن «' + target + '» وتحويلها إلى معلومات مؤكدة قابلة للنشر. ' + extra;
}

let LAST = null;
function esc(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

$('build').addEventListener('click', () => {
  const kind = $('kind').value;
  const v = {};
  let missing = null;
  for (const [id, label, ph, req] of KINDS[kind].fields) {
    v[id] = val(id);
    if (req && !v[id]) missing = label;
  }
  const err = $('formerr');
  if (missing) { err.textContent = 'أدخل الحقل المطلوب: ' + missing; err.hidden = false; return; }
  err.hidden = true;
  const stages = stagesFor(kind, v);
  LAST = { kind, v, stages, plan: planText(kind, v) };
  $('plan').innerHTML = '<strong>خطتك:</strong> ' + esc(LAST.plan);
  const host = $('stages');
  host.innerHTML = '';
  stages.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'card cmdstage';
    let h = '<h3>' + esc(s.t) + '</h3><p class="muted">' + esc(s.intro) + '</p><div class="cmdlist">';
    s.items.forEach((item, i) => {
      h += '<div class="cmd"><code>' + esc(item.cmd) + '</code><span class="cmdbtns">'
        + '<button type="button" class="copybtn" data-c="' + esc(item.cmd) + '">نسخ</button>'
        + '<a class="btn" href="' + esc(item.open) + '" target="_blank" rel="noopener noreferrer">فتح ↗</a></span></div>';
    });
    h += '</div>';
    card.innerHTML = h;
    host.appendChild(card);
  });
  $('outbox').hidden = false;
  $('status').textContent = '';
  $('outbox').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('.copybtn');
  if (!b) return;
  navigator.clipboard.writeText(b.dataset.c).then(() => {
    b.textContent = 'تم النسخ ✓';
    setTimeout(() => b.textContent = 'نسخ', 1500);
  });
});

function allText() {
  if (!LAST) return '';
  const names = { person: 'شخص', username: 'اسم مستخدم', email: 'بريد إلكتروني', phone: 'رقم هاتف', domain: 'نطاق', image: 'صورة', topic: 'موضوع عام' };
  let out = 'خطة بحث استقصائية — دليل المصادر المفتوحة للصحفيين العرب\n';
  out += 'نوع الهدف: ' + names[LAST.kind] + '\n';
  out += 'تاريخ الإنشاء: ' + new Date().toLocaleString('ar-EG') + '\n\n';
  out += 'الخطة: ' + LAST.plan + '\n\n';
  for (const s of LAST.stages) {
    out += '== ' + s.t + ' ==\n';
    for (const i of s.items) out += '- ' + i.cmd + '\n  ' + i.open + '\n';
    out += '\n';
  }
  out += 'تذكير: تحقق من كل معلومة بمصدرين مستقلين قبل النشر.\n';
  return out;
}

$('copyall').addEventListener('click', () => {
  if (!LAST) return;
  navigator.clipboard.writeText(allText()).then(() => { $('status').textContent = 'نُسخت كل الأوامر إلى الحافظة.'; });
});

$('download').addEventListener('click', () => {
  if (!LAST) return;
  const blob = new Blob([allText()], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'osint-plan.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  $('status').textContent = 'نُزّل ملف الخطة.';
});
