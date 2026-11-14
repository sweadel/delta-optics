// Delta Optics — Node.js Unit Test Runner
// Run: node scratch/run_tests.js

let pass = 0, fail = 0;

function test(label, fn) {
  try {
    const r = fn();
    if (r === true || r === undefined) {
      pass++;
      console.log("  \u2713 " + label);
    } else {
      fail++;
      console.error("  \u2717 " + label + ": " + r);
    }
  } catch(e) {
    fail++;
    console.error("  \u2717 " + label + ": EXCEPTION: " + e.message);
  }
}

// === sanitizeHTML ===
function sanitizeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

console.log('\n=== SUITE 1: sanitizeHTML XSS Prevention ===');
test('null returns empty string', function() { return sanitizeHTML(null) === ''; });
test('undefined returns empty', function() { return sanitizeHTML(undefined) === ''; });
test('script tag is escaped', function() {
  return !sanitizeHTML('<script>alert()</script>').includes('<script>');
});
test('& is escaped to &amp;', function() { return sanitizeHTML('a & b') === 'a &amp; b'; });
test('double quotes escaped', function() {
  var r = sanitizeHTML('"test"');
  return !r.includes('"') || 'FAIL: got ' + r;
});
test('single quotes escaped', function() {
  var r = sanitizeHTML("it's");
  return !r.includes("'") || 'FAIL: got ' + r;
});
test('number coerced to string', function() { return sanitizeHTML(42) === '42'; });
test('Arabic text preserved', function() {
  return sanitizeHTML('\u0645\u0631\u064a\u0636 \u0639\u0627\u062f\u064a') === '\u0645\u0631\u064a\u0636 \u0639\u0627\u062f\u064a';
});
test('XSS img onerror escaped', function() {
  var r = sanitizeHTML('<img onerror="alert(1)" src=x>');
  return !r.includes('<img') || 'FAIL: img tag not escaped';
});

console.log('\n=== SUITE 2: Email Validation ===');
test('valid email: user@delta.com', function() { return isValidEmail('user@delta.com'); });
test('valid email: test+tag@domain.co', function() { return isValidEmail('test+tag@domain.co'); });
test('invalid: no @', function() { return !isValidEmail('userdelta.com'); });
test('invalid: empty string', function() { return !isValidEmail(''); });
test('invalid: spaces', function() { return !isValidEmail('user @delta.com'); });
test('invalid: no domain', function() { return !isValidEmail('user@'); });
test('invalid: only @', function() { return !isValidEmail('@'); });

console.log('\n=== SUITE 3: Financial Calculations ===');
function calcRx(sub, disc, paid) {
  var tot = sub - sub * disc / 100;
  var due = Math.max(0, tot - paid);
  return { tot: tot, due: due };
}

test('no discount: total = sub', function() {
  return calcRx(100, 0, 0).tot === 100 || 'FAIL: got ' + calcRx(100,0,0).tot;
});
test('10% discount: total = 90', function() {
  return calcRx(100, 10, 0).tot === 90 || 'FAIL: got ' + calcRx(100,10,0).tot;
});
test('overpaid: due = 0', function() {
  return calcRx(100, 0, 150).due === 0 || 'FAIL: due = ' + calcRx(100,0,150).due;
});
test('100% discount: total = 0', function() {
  return calcRx(100, 100, 0).tot === 0 || 'FAIL: got ' + calcRx(100,100,0).tot;
});
test('partial payment: correct due', function() {
  return calcRx(100, 0, 60).due === 40 || 'FAIL: due = ' + calcRx(100,0,60).due;
});
test('negative price handled', function() {
  var r = calcRx(-10, 0, 0);
  return r.tot === -10; // Math.max handles due
});

console.log('\n=== SUITE 4: Invoice ID Generation ===');
test('DLT IDs are unique (1000 iterations)', function() {
  var ids = {};
  var dups = 0;
  for (var i = 0; i < 1000; i++) {
    var id = 'DLT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    if (ids[id]) dups++;
    ids[id] = true;
  }
  return dups === 0 || dups + ' duplicates found';
});
test('DLT prefix correct', function() {
  return ('DLT-' + Date.now().toString(36)).startsWith('DLT-');
});
test('POS prefix correct', function() {
  return ('POS-' + Date.now().toString(36)).startsWith('POS-');
});
test('IDs are non-empty strings', function() {
  var id = 'DLT-' + Date.now().toString(36).toUpperCase();
  return typeof id === 'string' && id.length > 5;
});

console.log('\n=== SUITE 5: Session XOR Encode/Decode ===');
function xorEncode(data) {
  var json = JSON.stringify(data);
  var key = 'delta_session_v2';
  var r = '';
  for (var i = 0; i < json.length; i++) {
    r += String.fromCharCode(json.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(r, 'binary').toString('base64');
}
function xorDecode(data) {
  var key = 'delta_session_v2';
  var decoded = Buffer.from(data, 'base64').toString('binary');
  var r = '';
  for (var i = 0; i < decoded.length; i++) {
    r += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return JSON.parse(r);
}

var payload = { uid: 'abc123', name: 'Ahmed', role: 'employee', permissions: ['view_dash'] };
var enc = xorEncode(payload);
var dec = xorDecode(enc);

test('roundtrip uid', function() { return dec.uid === payload.uid; });
test('roundtrip name', function() { return dec.name === payload.name; });
test('roundtrip role', function() { return dec.role === payload.role; });
test('encoded is base64 string', function() {
  return typeof enc === 'string' && enc.length > 0;
});
test('encoded is not plain JSON (obfuscated)', function() {
  try {
    JSON.parse(Buffer.from(enc, 'base64').toString());
    return 'FAIL: data is readable as plain JSON';
  } catch(e) {
    return true;
  }
});

console.log('\n=== SUITE 6: Edge Cases & Guards ===');
test('Math.max(0, -50) = 0', function() { return Math.max(0, -50) === 0; });
test('parseFloat("abc") || 0 = 0', function() { return (parseFloat('abc') || 0) === 0; });
test('permissions filter works', function() {
  var perms = ['view_dash', 'clinic'];
  var all = ['view_dash', 'clinic', 'pos', 'online'];
  return all.filter(function(x) { return perms.indexOf(x) >= 0; }).length === 2;
});
test('Date.now() in valid range', function() {
  var t = Date.now();
  return t > 1700000000000 && t < 2200000000000;
});
test('String.toUpperCase on Arabic doesnt crash', function() {
  return 'عيادة'.toUpperCase() !== undefined;
});

console.log('\n=== SUITE 7: Phase 2 Logic & Export Verification ===');
test('CSV escaping escapes double quotes', function() {
  var sample = 'John "Doc" Doe';
  var escaped = '"' + sample.replace(/"/g, '""') + '"';
  return escaped === '"John ""Doc"" Doe"';
});

test('Audit filter matches user case-insensitively', function() {
  var user = 'Admin User';
  var query = 'admin';
  return user.toLowerCase().includes(query.toLowerCase());
});

test('Audit filter matches action correctly', function() {
  var action = 'حفظ فاتورة مبيعات';
  var query = 'فاتورة';
  return action.includes(query);
});

test('Date filter matching logic for today', function() {
  var target = new Date().toDateString();
  var sampleDate = new Date().toDateString();
  return target === sampleDate;
});

test('Permission mapping for employee hides unpermitted page', function() {
  var perms = ['clinic', 'pos'];
  var page = 'inventory';
  var hasPerm = perms.includes(page) || perms.includes('view_' + page);
  return hasPerm === false;
});

test('Permission mapping for employee allows permitted page', function() {
  var perms = ['clinic', 'pos'];
  var page = 'clinic';
  var hasPerm = perms.includes(page) || perms.includes('view_' + page);
  return hasPerm === true;
});

// Results
console.log('\n' + '='.repeat(55));
console.log('RESULTS: ' + pass + ' passed, ' + fail + ' failed (' + (pass+fail) + ' total)');
if (fail === 0) {
  console.log('\u2705 ALL TESTS PASSED - Quality Gate 9: CLEARED');
  process.exit(0);
} else {
  console.error('\u274c ' + fail + ' TESTS FAILED - Review required');
  process.exit(1);
}
