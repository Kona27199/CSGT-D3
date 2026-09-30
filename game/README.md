# CSGT · Ca Tuần Tra (game pixel, chơi offline)

Game mô phỏng hoạt động tuần tra, kiểm soát của Cảnh sát giao thông, định hướng **giáo dục kết hợp giải trí**.
Người chơi vào vai một chiến sĩ CSGT mới ra trường, qua từng ca trực để phát hiện vi phạm, dừng xe đúng quy trình,
xác định đúng lỗi và mức phạt, ứng xử chuẩn mực và giữ liêm chính.

## 1. Cách chạy (offline 100%)

| Cách | Làm gì |
|---|---|
| **Máy tính** | Mở trực tiếp file `game/index.html` bằng Chrome, Edge hoặc Firefox. Không cần mạng, không cần cài đặt. |
| **Điện thoại** | Chép thư mục `game/` vào máy rồi mở `index.html` bằng trình duyệt. Hoặc đưa lên một máy chủ web (GitHub Pages…), mở một lần, chọn *Thêm vào màn hình chính*. Service worker sẽ lưu toàn bộ game vào máy để chơi offline. |

Game không tải bất kỳ tài nguyên nào từ Internet: đồ họa pixel và âm thanh 8-bit đều được tạo bằng code.
Tiến trình (điểm kỷ lục, số sao, XP, cấp bậc) được lưu trong trình duyệt (localStorage).

## 2. Điều khiển

- **Máy tính:** mũi tên hoặc `W A S D` để di chuyển · `SPACE` hoặc `E` để ra hiệu lệnh dừng xe hoặc xử lý tai nạn · `ESC` hoặc `P` để tạm dừng · phím `1–3` để chọn nhanh đáp án.
- **Điện thoại:** cần điều khiển bên trái, nút **DỪNG XE** bên phải, nút `II` để tạm dừng.

## 3. Kịch bản

| Ca | Bối cảnh | Trọng tâm |
|---|---|---|
| 1 · Ngày đầu nhận nhiệm vụ | 07:00, phố gần trường học | Đội trưởng hướng dẫn. Lỗi mũ bảo hiểm, chở quá số người, giấy tờ |
| 2 · Giờ cao điểm | 17:00, ngã tư đông xe | Vượt đèn đỏ, đi ngược chiều đường một chiều, dùng điện thoại |
| 3 · Chốt kiểm tra nồng độ cồn | 21:00, chốt theo kế hoạch | Đo nồng độ cồn mọi phương tiện, hối lộ, "người quen", bỏ chạy |
| 4 · Tuần tra quốc lộ | 10:00, quốc lộ 60 km/h | Máy đo tốc độ, xác định đúng mức vượt tốc độ |
| 5 · Đêm mưa | 22:00, mưa, tầm nhìn kém | Tổng hợp mọi lỗi và xử lý hiện trường tai nạn giao thông |
| Tuần tra tự do | Ngẫu nhiên | Bản đồ, thời tiết, giờ và mật độ đều ngẫu nhiên |
| Thử thách hôm nay | Cố định theo ngày | Mọi người chơi cùng một tình huống trong ngày, so kỷ lục |

Mở khóa ca sau khi đạt ít nhất 1 sao ở ca trước. Tích XP để thăng cấp: Hạ sĩ → Trung sĩ → … → Thiếu tá.

### Vòng chơi của một lượt dừng xe
1. **Phát hiện:** quan sát thẻ phóng to (mũ bảo hiểm, số người, điện thoại) và máy đo tốc độ. Dấu `!` đỏ nghĩa là xe vừa vượt đèn đỏ trước mặt tổ công tác.
2. **Tiếp cận:** chào theo điều lệnh, thông báo lý do dừng xe.
3. **Kiểm tra:** giấy tờ (bản giấy hoặc VNeID), tra cứu CSDL để phân biệt *không mang* với *không có* GPLX, đo nồng độ cồn.
4. **Tình huống ứng xử:** xin xỏ, nhờ người quen, đưa hối lộ, quay video, cãi lý.
5. **Kết luận:** chọn đúng các lỗi và hình thức xử lý. Màn hình kết quả hiện mức phạt và căn cứ pháp lý.

### Yếu tố chơi lại
Mỗi ca được sinh ngẫu nhiên từ một seed: phương tiện, lỗi hiện, **lỗi ẩn** (không có GPLX, bảo hiểm hết hạn, nồng độ cồn…),
thái độ người vi phạm, thời điểm xảy ra tai nạn. Ngoài ra có chấm sao, kỷ lục từng ca và kỷ lục thử thách theo ngày.

### Tính điểm
Xác định đúng lỗi +20 · bỏ sót −15 · kết luận sai −20 · đúng quy trình, ứng xử chuẩn mực +10 · từ chối hối lộ +30 ·
**nhận hối lộ: ca trực thất bại** · dừng xe không có căn cứ −10 · để lọt xe vi phạm rõ ràng −5 · mỗi lượt kiểm tra tốn 6 giây ca trực.

## 4. Dữ liệu pháp lý: cần đối chiếu

Toàn bộ lỗi và mức phạt nằm trong **`js/data.js`** (`DATA.VIOLATIONS`). Khi văn bản thay đổi, chỉ cần sửa file này.

- Căn cứ: **Nghị định 168/2024/NĐ-CP** (hiệu lực 01/01/2025), Luật TTATGTĐB 2024, Thông tư 73/2024/TT-BCA.
- Mục có `verify: true` (hiện dấu ⚠ trong game) là **điều/khoản/điểm hoặc mức trừ điểm chưa đối chiếu được với văn bản gốc**.
  Mức tiền phạt đã được đối chiếu qua các nguồn tổng hợp. Trước khi dùng game để tuyên truyền, cần kiểm tra lại các mục này.
- Chưa đưa vào game: lỗi *không có* đăng ký xe, tạm giữ phương tiện, xe quá tải. Các lỗi này phức tạp, dễ sai khi đơn giản hóa.

## 5. Cấu trúc mã nguồn

```
game/
├── index.html            # khung trang, HUD, nút cảm ứng
├── css/style.css         # giao diện kiểu pixel
├── js/util.js            # RNG có seed, lưu game
├── js/data.js            # DỮ LIỆU PHÁP LÝ, ca trực, hội thoại, tình huống
├── js/audio.js           # âm thanh 8-bit (WebAudio)
├── js/map.js             # sinh bản đồ đô thị / quốc lộ, biển báo, đèn tín hiệu
├── js/traffic.js         # phương tiện, hồ sơ vi phạm, di chuyển, vượt đèn đỏ
├── js/player.js          # nhân vật chiến sĩ CSGT
├── js/stop.js            # quy trình dừng xe, chấm điểm, bỏ chạy, tai nạn
├── js/ui.js              # menu, hộp thoại, tổng kết, sổ tay pháp luật
├── js/main.js            # vòng lặp game, điều khiển, camera, ánh sáng đêm, mưa
├── sw.js, manifest.webmanifest, icon.svg   # chạy offline dạng ứng dụng (PWA)
```

Có thể đóng gói thành APK Android (Capacitor) hoặc file .exe (Electron) mà không phải sửa mã game.
