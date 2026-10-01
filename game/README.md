# CSGT · Ca Tuần Tra (game 3D low-poly / pixel, chơi offline)

Game mô phỏng hoạt động tuần tra, kiểm soát của Cảnh sát giao thông, định hướng **giáo dục kết hợp giải trí**.
Người chơi vào vai một chiến sĩ CSGT mới ra trường, qua từng ca trực để phát hiện vi phạm, dừng xe đúng quy trình,
xác định đúng lỗi và mức phạt, ứng xử chuẩn mực và giữ liêm chính.

## 1. Cách chạy (offline 100%)

| Cách | Làm gì |
|---|---|
| **Máy tính** | Mở trực tiếp file `game/index.html` bằng Chrome, Edge hoặc Firefox. Không cần mạng, không cần cài đặt. |
| **Điện thoại** | Chép thư mục `game/` vào máy rồi mở `index.html` bằng trình duyệt. Hoặc đưa lên một máy chủ web (GitHub Pages…), mở một lần, chọn *Thêm vào màn hình chính*. Service worker sẽ lưu toàn bộ game vào máy để chơi offline. |

Game không tải bất kỳ tài nguyên nào từ Internet: mô hình 3D, đồ họa pixel và âm thanh 8-bit đều được tạo bằng code.
Thư viện 3D Three.js (r149, giấy phép MIT) được đóng kèm trong `vendor/three.min.js`.
Tiến trình (điểm kỷ lục, số sao, XP, cấp bậc) được lưu trong trình duyệt (localStorage).

### Cài trên điện thoại Android (file APK)
- Mỗi lần mã nguồn thay đổi, **GitHub Actions** tự build file APK (quy trình `.github/workflows/build-apk.yml`, dự án Android ở thư mục `android/`).
- Tải APK ở mục **Releases** của repo (bản mới nhất ở đầu), mở file trên điện thoại, cho phép cài ứng dụng không rõ nguồn gốc rồi cài đặt.
- Yêu cầu Android 7.0 trở lên. Chơi hoàn toàn offline. Nút Quay lại hỏi trước khi thoát; chuyển sang ứng dụng khác thì game tự tạm dừng.
- Khóa ký APK lưu trong repo (`android/keystore/`) để các bản sau cài đè lên bản trước, giữ nguyên tiến trình. Khóa này chỉ dùng cài nội bộ; muốn phát hành lên Google Play cần tạo khóa riêng và giữ bí mật.

## 2. Ba chế độ chơi (chọn ở màn hình "Chọn ca tuần tra")

| Chế độ | Cách chơi |
|---|---|
| 🚧 **Chốt kiểm soát** (mặc định, dễ) | Đứng tại chốt. Từng phương tiện vào chốt, dừng trước mặt và hiện **phóng to** ở bảng quan sát. Bấm **DỪNG XE** hoặc **CHO QUA** trước khi hết giờ. Ca 1 có gợi ý. |
| 🏍 **Tuần tra mô tô** | Lái mô tô tuần tra trên phố. Xử lý vi phạm của **xe mô tô, xe máy**: mũ bảo hiểm, chở quá số người, điện thoại, vượt đèn đỏ, đi ngược chiều, tốc độ, nồng độ cồn, giấy tờ. Ô tô trên đường nằm ngoài phạm vi. |
| 🚓 **Tuần tra ô tô** | Lái ô tô tuần tra trên quốc lộ theo **chuyên đề**: xe tải **quá tải** (cân tải trọng), **quá khổ** (đo chiều cao xếp hàng), **xe khách chở quá số người** (kiểm đếm), **nồng độ cồn** người điều khiển ô tô (bắt buộc đo). Xe máy nằm ngoài phạm vi. |

Ở hai chế độ tuần tra: xe có dấu hiệu vi phạm ở gần hiện biểu tượng **!** vàng, thẻ quan sát ghi rõ "Dấu hiệu". Ra hiệu lệnh dừng xe bằng còi hụ và loa.

### Đồ họa 3D low-poly (mặc định) – BẢN THỬ
- Mọi thứ dựng bằng khối 3D đơn giản, tô màu phẳng: nhà phố nhiều tầng có mái hiên sọc, biển hiệu, ban công, bồn nước; nhà máy, ký túc xá, nhà mái ngói; cây tán khối, tre, dừa; cột điện, dây điện, đèn đường, đèn tín hiệu, biển báo; xe máy có người lái (thấy rõ đội mũ hay không, chở mấy người, cầm điện thoại), ô tô, xe khách, xe tải (thấy hàng chở vượt thành thùng, quá chiều cao).
- **Camera nhìn nghiêng cố định**, bám theo tổ công tác; **xoay 90°** bằng nút **⟲ / ⟳** hoặc phím **Q / R** (hướng phím điều khiển tự xoay theo); **thu phóng 5 mức** bằng − / +.
- Nhà/cây nằm giữa camera và người chơi được **tự đục lỗ** để luôn nhìn thấy xe tuần tra.
- Ánh sáng theo giờ: ban ngày có bóng đổ, hoàng hôn nhuộm cam, ban đêm cửa sổ sáng đèn, quầng đèn đường, đèn pha; mưa có màn mưa và sương mù.
- **Đổi đồ họa:** nút **🎨 Đồ họa: 3D / Pixel** ở màn hình chính hoặc menu tạm dừng (đổi ngay, không mất tiến trình). Thiết bị không hỗ trợ WebGL tự dùng Pixel.
- **⚙ Chất lượng 3D: Thấp / Vừa / Cao** – Thấp: tắt bóng đổ, độ phân giải 1x (máy yếu); Cao: bóng đổ nét, độ phân giải 2x. Khử răng cưa áp dụng khi mở lại game.

### Đồ họa Pixel (tùy chọn)
- Đồ họa pixel vẽ ở độ phân giải gấp đôi, hiển thị theo bội số nguyên của điểm ảnh màn hình nên luôn sắc nét.
- **Thu phóng:** nút **− / +** ở góc dưới bên phải, con lăn chuột, hoặc phím **+ / −**. Mặc định nhìn rộng; có **bản đồ nhỏ** ở góc trên bên phải (vị trí tổ công tác, khung nhìn, hiện trường tình huống).
- **Nhà 2.5D** có chiều cao, mặt tiền nhiều tầng, ban công, điều hòa, cửa hàng có biển hiệu; cửa sổ sáng đèn ban đêm; bóng đổ xuống đất.
- **Hoạt cảnh:** người đi bộ trên vỉa hè (nón lá, công nhân đội mũ, áo mưa khi trời mưa), cây đung đưa, nước lăn tăn, khói xe tải và ống khói nhà máy, bụi đường đất, mưa bắn tóe, chim bay.
- **Ánh sáng:** quầng đèn đường vàng ấm, đèn pha, đèn phanh, đèn ưu tiên xanh – đỏ hắt xuống mặt đường, mặt đường ướt phản chiếu khi mưa, hoàng hôn nhuộm cam.
- **Chi tiết đường phố:** cột điện, dây điện, cây xanh vỉa hè có ô bảo vệ gốc, xe máy đỗ, nắp cống, mũi tên chỉ hướng trên làn, gờ giảm tốc, biển cấm đỗ, biển người đi bộ, biển trường học.

## 3. Điều khiển

- **Thu phóng:** `+` / `−`, con lăn chuột, hoặc nút −/+ trên màn hình. **Xoay camera (3D):** `Q` / `R` hoặc nút ⟲ / ⟳.
- **Máy tính:** mũi tên hoặc `W A S D` để di chuyển (chế độ tuần tra) · `SPACE` hoặc `E` để ra hiệu lệnh dừng xe hoặc xử lý tai nạn · `C` để cho qua (chế độ chốt) · `ESC` hoặc `P` để tạm dừng · phím `1–3` để chọn nhanh đáp án.
- **Điện thoại:** chế độ chốt bấm nút **DỪNG XE / CHO QUA** trên bảng quan sát; chế độ tuần tra dùng cần điều khiển bên trái và nút **DỪNG XE** bên phải; nút `II` để tạm dừng.

## 4. Kịch bản

| Ca | Bản đồ | Trọng tâm |
|---|---|---|
| 1 · Ngày đầu nhận nhiệm vụ | Phố đô thị, 07:00 | Đội trưởng hướng dẫn. Mũ bảo hiểm, chở quá số người, giấy tờ |
| 2 · Giờ cao điểm | Phố đô thị, 17:00 | Vượt đèn đỏ, đi ngược chiều, điện thoại |
| 3 · Chốt kiểm tra nồng độ cồn | Phố đô thị, 21:00 | Đo nồng độ cồn, hối lộ, "người quen", bỏ chạy |
| 4 · Tuần tra quốc lộ | Quốc lộ, 10:00 | Máy đo tốc độ |
| 5 · Đêm mưa | Phố đô thị, 22:00, mưa | Tổng hợp mọi lỗi, nhiều tình huống đặc biệt |
| 6 · Khu công nghiệp tan ca | **Khu công nghiệp**, 17:30 | Xe tải quá tải, quá khổ; công nhân chở quá số người |
| 7 · Đường làng mùa lễ hội | **Nông thôn**, 19:30 | Rượu bia, không đội mũ, đua xe |
| 8 · Cao tốc cuối tuần | **Đường cao tốc**, 09:30 (mở sau Ca 4) | Làn dừng khẩn cấp, dưới tốc độ tối thiểu, xe máy vào cao tốc, xe gặp sự cố cần hỗ trợ |
| 9 · Khu đô thị mới | **Khu đô thị mới**, 08:00 (mở sau Ca 2) | Không nhường đường ở vòng xuyến, vượt đường ngang khi đèn đỏ |
| 10 · Cao tốc sương mù | Đường cao tốc, 05:45 (mở sau Ca 8) | 🌫 Sương mù + 🙈 Không gợi ý |
| 11 · Tan tầm khu đô thị | Khu đô thị mới, 17:30 (mở sau Ca 9) | 🚦 Ùn tắc + ⚖ Kỷ luật nghiêm |
| 12 · Đêm mưa thử thách | Phố đô thị, 22:30, mưa (mở sau Ca 5) | 🙈 Không gợi ý + ⚖ Kỷ luật nghiêm |
| Tuần tra tự do / Thử thách hôm nay | Ngẫu nhiên 6 bản đồ (thử thách hôm nay có thêm 1 điều kiện khó) | Mọi thứ ngẫu nhiên |

**Hai bản đồ mới:**
- **Đường cao tốc:** 2 chiều × 2 làn, làn dừng khẩn cấp hai bên, dải phân cách cứng giữa, hộ lan tôn sóng, giá long môn biển báo, biển tốc độ tối đa 100 km/h và tối thiểu 60 km/h, trạm dừng nghỉ. Xe mô tô không được đi vào cao tốc nên các ca trên bản đồ này chỉ chơi chế độ **Chốt** hoặc **Tuần tra ô tô** (chọn mô tô sẽ tự chuyển sang ô tô). Xe dừng ở làn khẩn cấp có thể **đúng quy định** (gặp sự cố và bật đèn khẩn cấp: hỗ trợ, không xử phạt) hoặc **sai quy định** (dừng nghỉ, đi vệ sinh, chụp ảnh, nghe điện thoại, hoặc không bật đèn khẩn cấp) – phải hỏi lý do và quan sát đèn để kết luận.
- **Khu đô thị mới:** đại lộ 4 làn, **vòng xuyến** có đảo tròn (xe đi vòng ngược chiều kim đồng hồ, phải nhường xe đang đi trong vòng xuyến; nhiều xe máy luồn lách qua hàng chờ để chen vào), **đường ngang giao cắt đường sắt** có chắn tự động, đèn đỏ nhấp nháy và tàu chạy qua; chung cư cao tầng, hồ điều hòa. Ở chế độ chốt, vi phạm tại vòng xuyến/đường ngang đến qua tin báo của camera giám sát.

**Điều kiện ca khó** (hiện trên thẻ ca và trên thanh thông tin): 🌫 Sương mù (tầm nhìn hạn chế, dấu ! chỉ hiện khi rất gần) · 🚦 Ùn tắc (mật độ xe ×1,7, xe chạy chậm) · ⚖ Kỷ luật nghiêm (sai sót quá 3 lần: kết luận sai, bỏ sót hoặc để lọt → bị đình chỉ ca trực) · 🙈 Không gợi ý (thẻ quan sát không liệt kê dấu hiệu, không có dấu !).

**Bốn bản đồ ban đầu:** Phố đô thị (đường một chiều, 2 ngã tư có đèn) · Quốc lộ (4 làn, ruộng lúa, làng ven đường) · Nông thôn (tỉnh lộ, đường liên xã, kênh mương, cầu, ruộng lúa, nhà mái ngói, chợ quê) · Khu công nghiệp (đường 4 làn, nhà xưởng, bãi container, cổng KCN, trạm cân, khu nhà trọ công nhân).

### Tình huống đặc biệt (phát sinh ngẫu nhiên 2–3 lần mỗi ca)
| Tình huống | Cách xử lý trong game |
|---|---|
| 🚑 Tai nạn (va chạm xe máy – ô tô, xe tải lật đổ hàng, xe máy tự ngã) | Đến hiện trường, trả lời 3 câu về quy trình: cảnh báo, phân luồng, sơ cứu, ghi nhận, đo nồng độ cồn |
| 🦹 Cướp giật | Bám theo xe đối tượng (áo đen, che biển số), áp sát an toàn, xử lý và bàn giao |
| 🚨 Truy nã | Băng rôn hiện tên và biển số; tìm đúng xe trong dòng xe, dừng xe, khống chế an toàn, bàn giao. Ở chế độ chốt: để lọt qua chốt bị trừ 40 điểm |
| 🏍 Đua xe trái phép | Không truy đuổi nguy hiểm; ghi nhận, phối hợp; xử lý người chưa thành niên đúng quy định |
| 🤝 Hỗ trợ nhân dân | Mở đường cho xe cấp cứu, hỗ trợ xe chết máy, đưa trẻ lạc về trụ sở Công an, dìu cụ già qua đường |

### Nhiệm vụ trong ca
Mỗi ca có 3 nhiệm vụ ngẫu nhiên phù hợp chế độ và bản đồ (ví dụ: xử lý 3 trường hợp không đội mũ bảo hiểm, xử lý 2 xe quá tải, xử lý tốt 2 tình huống đặc biệt, không để lọt xe vi phạm...). Hoàn thành được thưởng 30–60 điểm.

### Vòng chơi của một lượt dừng xe
1. **Phát hiện:** quan sát bảng/thẻ phóng to (mũ bảo hiểm, số người, điện thoại), máy đo tốc độ và tin báo.
2. **Tiếp cận:** chào theo điều lệnh, thông báo lý do dừng xe.
3. **Kiểm tra:** giấy tờ (bản giấy hoặc VNeID), tra cứu CSDL để phân biệt *không mang* với *không có* GPLX, đo nồng độ cồn.
4. **Tình huống ứng xử:** xin xỏ, nhờ người quen, đưa hối lộ, quay video, cãi lý.
5. **Kết luận theo bằng chứng:** mỗi bằng chứng thu được (mũ bảo hiểm, số người, tốc độ, nồng độ cồn, GPLX, đăng ký xe, bảo hiểm…) là một dòng có 3 lựa chọn: đúng lỗi + đúng mức phạt / đúng lỗi nhưng sai mức phạt / không vi phạm. Màn hình kết quả hiện kết luận đúng, mức phạt và căn cứ pháp lý.

### Yếu tố chơi lại
Mỗi ca được sinh ngẫu nhiên từ một seed: phương tiện, lỗi hiện, **lỗi ẩn** (không có GPLX, bảo hiểm hết hạn, nồng độ cồn…),
thái độ người vi phạm, thời điểm xảy ra tai nạn. Ngoài ra có chấm sao, kỷ lục từng ca và kỷ lục thử thách theo ngày.

### Tính điểm
Kết luận đúng lỗi và mức phạt +20 · đúng "không vi phạm" +5 · đúng lỗi nhưng sai mức phạt −10 · sai hoặc bỏ sót −15 ·
đúng quy trình, ứng xử chuẩn mực +10 · từ chối hối lộ +30 · **nhận hối lộ: ca trực thất bại** · dừng xe không có căn cứ −10 ·
chế độ chốt: cho qua đúng +5, bỏ lọt −10 · chế độ tuần tra: để lọt xe vi phạm rõ ràng −5 · mỗi lượt kiểm tra tốn 6 giây ca trực.

## 5. Dữ liệu pháp lý: cần đối chiếu

Toàn bộ lỗi và mức phạt nằm trong **`js/data.js`** (`DATA.VIOLATIONS`). Khi văn bản thay đổi, chỉ cần sửa file này.

- Căn cứ: **Nghị định 168/2024/NĐ-CP** (hiệu lực 01/01/2025), Luật TTATGTĐB 2024, Thông tư 73/2024/TT-BCA.
- Lỗi **vượt đường ngang khi đèn đỏ đã bật, chắn đang dịch chuyển** thuộc lĩnh vực đường sắt: **Nghị định 81/2026/NĐ-CP** (ngày 19/3/2026, hiệu lực 15/5/2026) – ô tô khoản 9 Điều 13: 18–20 triệu đồng; mô tô, xe gắn máy khoản 6 Điều 13: 4–6 triệu đồng; cùng tước GPLX 01–03 tháng (⚠ đối chiếu).
- Lỗi mới trên cao tốc / vòng xuyến (NĐ 168/2024): chạy ở làn dừng khẩn cấp – điểm d khoản 5 Điều 6 (4–6 triệu, trừ 02 điểm); dừng, đỗ trên cao tốc không đúng nơi quy định / không bật đèn khẩn cấp khi buộc phải dừng ở làn khẩn cấp – điểm c khoản 7 Điều 6 (12–14 triệu, trừ 06 điểm); chạy dưới tốc độ tối thiểu – khoản 3 Điều 6 (800 nghìn–1 triệu, ⚠ điểm cụ thể); xe mô tô đi vào cao tốc – khoản 7 Điều 7 (4–6 triệu, trừ 06 điểm, ⚠); không nhường đường tại vòng xuyến – ô tô điểm o khoản 5 Điều 6 (4–6 triệu), mô tô điểm d khoản 6 Điều 7 (2–3 triệu), cùng trừ 02 điểm (⚠).
- Mục có `verify: true` (hiện dấu ⚠ trong game) là **điều/khoản/điểm hoặc mức trừ điểm chưa đối chiếu được với văn bản gốc**.
  Mức tiền phạt đã được đối chiếu qua các nguồn tổng hợp. Trước khi dùng game để tuyên truyền, cần kiểm tra lại các mục này.
- Lỗi chuyên đề ô tô (Điều 20, 21): quá tải theo 4 mức (trên 10–30%, 30–50%, 50–100%, 100–150%; từ 10% trở xuống chưa xử phạt), chở hàng vượt chiều cao xếp hàng (giới hạn 4,2 m áp dụng cho xe trong game), xe khách chở quá số người (phạt theo mỗi người vượt, tuyến dưới 300 km, tổng không quá 75 triệu đồng). Toàn bộ đánh dấu ⚠ cần đối chiếu.
- Chưa đưa vào game: lỗi *không có* đăng ký xe, tạm giữ phương tiện, quá tải trên 150%, vượt chiều dài/chiều rộng xếp hàng, xử phạt chủ xe/doanh nghiệp vận tải.

## 6. Cấu trúc mã nguồn

```
game/
├── index.html            # khung trang, HUD, nút cảm ứng
├── css/style.css         # giao diện kiểu pixel
├── js/util.js            # RNG có seed, lưu game
├── js/data.js            # DỮ LIỆU PHÁP LÝ, ca trực, hội thoại, tình huống
├── js/audio.js           # âm thanh 8-bit (WebAudio)
├── js/map.js             # sinh 6 bản đồ (đô thị, quốc lộ, nông thôn, KCN, cao tốc, đô thị mới), biển báo, đèn tín hiệu, rào chắn
├── js/traffic.js         # phương tiện, hồ sơ vi phạm, di chuyển, vượt đèn đỏ
├── js/player.js          # nhân vật chiến sĩ CSGT
├── js/stop.js            # quy trình dừng xe, chấm điểm, bỏ chạy, tai nạn
├── js/ui.js              # menu, hộp thoại, tổng kết, sổ tay pháp luật
├── js/sprites.js         # đồ họa pixel chi tiết (vẽ ở độ phân giải gấp đôi)
├── js/events.js          # tình huống đặc biệt + nhiệm vụ trong ca
├── js/life.js            # người đi bộ, cây đung đưa, khói, mưa, nước, chim
├── js/r3d.js             # đồ họa 3D low-poly: dựng bản đồ, mô hình xe/người, camera xoay, ánh sáng
├── js/main.js            # vòng lặp game, điều khiển, camera, ánh sáng đêm, mưa, lớp phủ 3D
├── vendor/three.min.js   # thư viện Three.js r149 (MIT, xem vendor/THREE-LICENSE.txt)
├── sw.js, manifest.webmanifest, icon.svg   # chạy offline dạng ứng dụng (PWA)
```

Có thể đóng gói thành APK Android (Capacitor) hoặc file .exe (Electron) mà không phải sửa mã game.
