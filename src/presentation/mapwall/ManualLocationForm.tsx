import { useState } from "react";
export interface ManualLocationInput {
  name: string;
  country: string;
  lat: number;
  lng: number;
}
export function ManualLocationForm({
  count,
  onSave,
  onCancel,
}: {
  count: number;
  onSave: (input: ManualLocationInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(""),
    [country, setCountry] = useState(""),
    [lat, setLat] = useState(""),
    [lng, setLng] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="card manual-location"
      aria-label="手动补位置"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          if (!lat.trim() || !lng.trim())
            throw new Error("请填写经纬度，0也是有效坐标");
          await onSave({ name, country, lat: Number(lat), lng: Number(lng) });
        } catch (failure) {
          setError(
            failure instanceof Error ? failure.message : "没有保存成功，请重试",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>给 {count} 张照片指定位置</h3>
      <p>
        可填写任意地点，不依赖网络建议。坐标将标为“手动”，不会更改原图或拍摄时间。
      </p>
      <fieldset
        disabled={busy}
        style={{ border: 0, display: "grid", gap: 12, padding: 0 }}
      >
        <label>
          地点名
          <input
            required
            maxLength={100}
            aria-label="地点名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：巴黎 / 我的小镇"
          />
        </label>
        <label>
          国家或地区
          <input
            required
            maxLength={100}
            aria-label="国家或地区"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="例如：法国"
          />
        </label>
        <label>
          纬度
          <input
            required
            type="number"
            min={-90}
            max={90}
            step="any"
            aria-label="纬度"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="例如：48.858"
          />
        </label>
        <label>
          经度
          <input
            required
            type="number"
            min={-180}
            max={180}
            step="any"
            aria-label="经度"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="例如：2.295"
          />
        </label>
        <p>
          纬度 −90～90，经度
          −180～180。可从你熟悉的地图复制坐标；地点名可自行编辑。
        </p>
        <button type="submit" className="btn primary">
          {busy ? "保存中…" : "保存位置并继续确认"}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          取消补位置
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
