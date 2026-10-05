<?php
/**
 * TDK Designs: quote form handler.
 * Receives the form on contact.html and emails it, with the customer's file attached if they sent one.
 * To change where quote requests go, edit the two addresses below.
 */

$recipient = "infor@tdkdesigns.co.za";       // main mailbox for quote requests
$copyTo    = "mudimelidesmond@gmail.com";    // receives a copy of every request
$maxFile   = 5 * 1024 * 1024;                 // 5 MB
$allowed   = [                                // file types customers may attach
    "jpg"  => "image/jpeg",
    "jpeg" => "image/jpeg",
    "png"  => "image/png",
    "webp" => "image/webp",
    "gif"  => "image/gif",
    "pdf"  => "application/pdf",
];
$fallback  = "Please call or WhatsApp us on 071 373 6835.";

$isAjax = isset($_SERVER["HTTP_X_REQUESTED_WITH"]);

function finish($ok, $code, $text, $isAjax) {
    if ($isAjax) {
        http_response_code($code);
        header("Content-Type: text/plain; charset=UTF-8");
        echo $text;
    } else {
        // No JavaScript: send the visitor back to the contact page with a result flag.
        header("Location: contact.html?sent=" . ($ok ? "1" : "0") . "#quote", true, 303);
    }
    exit;
}

// Works whether or not the server has PHP's mbstring extension switched on.
function cut($value, $max) {
    return function_exists("mb_substr") ? mb_substr($value, 0, $max) : substr($value, 0, $max);
}

function subject_header($value) {
    return function_exists("mb_encode_mimeheader")
        ? mb_encode_mimeheader($value, "UTF-8")
        : "=?UTF-8?B?" . base64_encode($value) . "?=";
}

function clean_line($value, $max) {
    // Single-line fields: strip tags and line breaks so they cannot inject email headers.
    $value = strip_tags(trim((string) $value));
    $value = preg_replace('/[\r\n\t]+/', ' ', $value);
    return cut($value, $max);
}

if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
    finish(false, 405, "Please use the form on the contact page.", $isAjax);
}

// If the upload is bigger than the server accepts, PHP discards the whole form.
if (empty($_POST) && (int) ($_SERVER["CONTENT_LENGTH"] ?? 0) > 0) {
    finish(false, 413, "That file is too large to send here. Please send it on WhatsApp instead: 071 373 6835.", $isAjax);
}

// Honeypot: real visitors never see or fill this field.
if (!empty($_POST["website"])) {
    finish(true, 200, "Message sent.", $isAjax);
}

$name     = clean_line($_POST["name"] ?? "", 100);
$phone    = clean_line($_POST["phone"] ?? "", 30);
$service  = clean_line($_POST["service"] ?? "", 60);
$size     = clean_line($_POST["size"] ?? "", 100);
$quantity = clean_line($_POST["quantity"] ?? "", 40);
$deadline = clean_line($_POST["deadline"] ?? "", 80);
$message  = cut(trim(strip_tags((string) ($_POST["message"] ?? ""))), 4000);
$emailRaw = trim((string) ($_POST["email"] ?? ""));
$email    = $emailRaw === "" ? "" : filter_var($emailRaw, FILTER_VALIDATE_EMAIL);

if ($name === "" || $phone === "" || $message === "") {
    finish(false, 400, "Please fill in your name, phone number and the details of what you need.", $isAjax);
}
if ($email === false) {
    finish(false, 400, "That email address does not look right. Please check it, or leave it empty.", $isAjax);
}

// ---- Optional attachment
$attachment = null;
if (isset($_FILES["artwork"]) && $_FILES["artwork"]["error"] !== UPLOAD_ERR_NO_FILE) {
    $file = $_FILES["artwork"];
    if ($file["error"] === UPLOAD_ERR_INI_SIZE || $file["error"] === UPLOAD_ERR_FORM_SIZE || $file["size"] > $maxFile) {
        finish(false, 400, "That file is larger than 5 MB. Please choose a smaller one, or send it on WhatsApp: 071 373 6835.", $isAjax);
    }
    if ($file["error"] !== UPLOAD_ERR_OK || !is_uploaded_file($file["tmp_name"])) {
        finish(false, 400, "Your file did not upload properly. Please try again, or send it on WhatsApp: 071 373 6835.", $isAjax);
    }
    $ext = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));
    $type = function_exists("finfo_open")
        ? finfo_file(finfo_open(FILEINFO_MIME_TYPE), $file["tmp_name"])
        : ($allowed[$ext] ?? "");
    if (!isset($allowed[$ext]) || $allowed[$ext] !== $type) {
        finish(false, 400, "Please attach a JPG, PNG or PDF file. Other file types can be sent on WhatsApp: 071 373 6835.", $isAjax);
    }
    $safeName = trim(preg_replace('/[^A-Za-z0-9._-]+/', '-', pathinfo($file["name"], PATHINFO_FILENAME)), "-.");
    $attachment = [
        "name" => ($safeName !== "" ? cut($safeName, 60) : "artwork") . "." . $ext,
        "type" => $type,
        "data" => chunk_split(base64_encode(file_get_contents($file["tmp_name"]))),
    ];
}

// ---- Build the email
$subject = "Quote request from " . $name . ($service !== "" ? " (" . $service . ")" : "");

$text  = "New quote request from the website\n\n";
$text .= "Name:     " . $name . "\n";
$text .= "Phone:    " . $phone . "\n";
$text .= "Email:    " . ($email !== "" ? $email : "not given") . "\n";
$text .= "Product:  " . ($service !== "" ? $service : "not chosen") . "\n";
$text .= "Size:     " . ($size !== "" ? $size : "not given") . "\n";
$text .= "Quantity: " . ($quantity !== "" ? $quantity : "not given") . "\n";
$text .= "Deadline: " . ($deadline !== "" ? $deadline : "not given") . "\n";
$text .= "File:     " . ($attachment ? $attachment["name"] . " (attached)" : "none") . "\n\n";
$text .= "Details:\n" . $message . "\n";

// Send from the site's own domain (better deliverability); replies go to the customer if they gave an email.
$host = preg_replace('/^www\./', '', preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER["SERVER_NAME"] ?? "localhost"));
$headers  = "From: TDK Designs website <no-reply@" . $host . ">\r\n";
$headers .= "Cc: " . $copyTo . "\r\n";
if ($email !== "") {
    $headers .= "Reply-To: " . $email . "\r\n";
}
$headers .= "MIME-Version: 1.0\r\n";

if ($attachment) {
    $boundary = "tdk-" . bin2hex(random_bytes(12));
    $headers .= "Content-Type: multipart/mixed; boundary=\"" . $boundary . "\"\r\n";
    $body  = "--" . $boundary . "\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $text . "\r\n";
    $body .= "--" . $boundary . "\r\n";
    $body .= "Content-Type: " . $attachment["type"] . "; name=\"" . $attachment["name"] . "\"\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n";
    $body .= "Content-Disposition: attachment; filename=\"" . $attachment["name"] . "\"\r\n\r\n";
    $body .= $attachment["data"] . "\r\n";
    $body .= "--" . $boundary . "--\r\n";
} else {
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body = $text;
}

if (mail($recipient, subject_header($subject), $body, $headers)) {
    finish(true, 200, "Message sent.", $isAjax);
}

finish(false, 500, "Your request was not sent. " . $fallback, $isAjax);
