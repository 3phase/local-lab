import { useMemo, useState } from "react";
import type { FieldRelationship, SuggestedAction } from "../../analysis/correlationTypes";
import { Card } from "../layout/AppShell";

const labels: Record<SuggestedAction, string> = {
  recommended: "Recommended",
  weak_signal: "Weak signal",
  probably_ignore: "Probably ignore",
  review_manually: "Review manually",
  possible_leakage: "Possible leakage"
};
const methodLabels: Record<FieldRelationship["method"], string> = {
  pearson: "Pearson correlation",
  spearman: "Spearman correlation",
  point_biserial: "Point-biserial",
  anova_f_score: "ANOVA F-score",
  cramers_v: "Cramér’s V",
  correlation_ratio: "Correlation ratio",
  not_analyzed: "Not analyzed"
};
const explanations: Record<FieldRelationship["method"], string> = {
  pearson:
    "Measures the strength of a linear relationship between two numeric fields.",
  spearman: "Measures whether two numeric fields move together monotonically.",
  point_biserial:
    "Measures separation between two target classes using a numeric field.",
  anova_f_score:
    "Compares variation between class means with variation inside each class.",
  cramers_v:
    "Measures association between two categorical fields using a contingency table.",
  correlation_ratio:
    "Measures how much a numeric target differs across categories.",
  not_analyzed:
    "This field type is not analyzed automatically in the first version."
};
const pretty = (value: unknown): string =>
  typeof value === "number"
    ? Number(value).toFixed(3)
    : typeof value === "object" && value
      ? Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${pretty(v)}`)
        .join(" · ")
      : String(value ?? "—");

export function FieldCorrelationStep({
                                       relationships,
                                       loading,
                                       onUseRecommended,
                                       onIgnoreWeak,
                                       onContinue
                                     }: {
  relationships: FieldRelationship[];
  loading: boolean;
  onUseRecommended: () => void;
  onIgnoreWeak: () => void;
  onContinue: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [sort, setSort] = useState<"score" | "field" | "missing">("score");
  const sorted = useMemo(
    () =>
      [...relationships].sort((a, b) =>
        sort === "field"
          ? a.fieldName.localeCompare(b.fieldName)
          : sort === "missing"
            ? b.missingPercentage - a.missingPercentage
            : (b.normalizedScore ?? -1) - (a.normalizedScore ?? -1)
      ),
    [relationships, sort]
  );
  const detail =
    relationships.find((r) => r.fieldName === selected) ?? relationships[0];
  const positive = relationships
      .filter((r) => r.direction === "positive")
      .sort((a, b) => (b.normalizedScore ?? 0) - (a.normalizedScore ?? 0))[0],
    negative = relationships
      .filter((r) => r.direction === "negative")
      .sort((a, b) => (b.normalizedScore ?? 0) - (a.normalizedScore ?? 0))[0];
  const recommended = relationships.filter(
      (r) => r.suggestedAction === "recommended"
    ).length,
    leakage = relationships.filter(
      (r) => r.suggestedAction === "possible_leakage"
    ).length;
  return (
    <Card className="correlation-step">
      <div className="card-title">
        <div>
          <span className="eyebrow">FIELD CORRELATION</span>
          <h2>Where might the predictive signal be?</h2>
        </div>
        {loading && <span className="task-pill">Analyzing…</span>}
      </div>
      <p className="correlation-intro">
        This step estimates how strongly each field is related to the prediction
        field. Strong correlation can be useful, but it does not prove
        causation. Very strong relationships may also indicate data leakage,
        where a field reveals the answer too directly.
      </p>
      {loading ? (
        <div className="analysis-loading">
          <i />
          <span>Computing relationships without changing your data…</span>
        </div>
      ) : (
        <>
          <div className="correlation-summary">
            <div>
              <span>Strongest positive</span>
              <b>{positive?.fieldName ?? "None"}</b>
              <small>{positive?.normalizedScore?.toFixed(2) ?? "—"}</small>
            </div>
            <div>
              <span>Strongest negative</span>
              <b>{negative?.fieldName ?? "None"}</b>
              <small>{negative?.normalizedScore?.toFixed(2) ?? "—"}</small>
            </div>
            <div>
              <span>Recommended fields</span>
              <b>{recommended}</b>
              <small>moderate or stronger</small>
            </div>
            <div className={leakage ? "warn" : ""}>
              <span>Possible leakage</span>
              <b>{leakage}</b>
              <small>{leakage ? "review carefully" : "none detected"}</small>
            </div>
          </div>
          <div className="correlation-toolbar">
            <div>
              Sort by{" "}
              <button
                className={sort === "score" ? "active" : ""}
                onClick={() => setSort("score")}
              >
                Score
              </button>
              <button
                className={sort === "field" ? "active" : ""}
                onClick={() => setSort("field")}
              >
                Field
              </button>
              <button
                className={sort === "missing" ? "active" : ""}
                onClick={() => setSort("missing")}
              >
                Missing
              </button>
            </div>
            <div>
              <button className="text-btn" onClick={onIgnoreWeak}>
                Ignore weak fields
              </button>
              {leakage > 0 && (
                <button
                  className="text-btn warning-link"
                  onClick={() =>
                    setSelected(
                      relationships.find(
                        (r) => r.suggestedAction === "possible_leakage"
                      )?.fieldName ?? null
                    )
                  }
                >
                  Review leakage fields
                </button>
              )}
            </div>
          </div>
          <div className="correlation-layout">
            <div className="table-wrap correlation-table">
              <table>
                <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Method</th>
                  <th>Direction</th>
                  <th>Missing</th>
                  <th>Unique</th>
                  <th>Suggested action</th>
                </tr>
                </thead>
                <tbody>
                {sorted.map((r) => (
                  <tr
                    key={r.fieldName}
                    className={`${selected === r.fieldName ? "selected" : ""} ${r.suggestedAction === "possible_leakage" ? "leakage-row" : ""}`}
                    onClick={() => setSelected(r.fieldName)}
                  >
                    <td>
                      <b>{r.fieldName}</b>
                      {r.warnings.length > 0 && (
                        <em title={r.warnings.join(" ")}>!</em>
                      )}
                    </td>
                    <td>{r.fieldType}</td>
                    <td>
                      <div className="signal-score">
                        <i
                          style={{
                            width: `${(r.normalizedScore ?? 0) * 100}%`
                          }}
                        />
                        <b>{r.normalizedScore?.toFixed(2) ?? "—"}</b>
                      </div>
                    </td>
                    <td>{methodLabels[r.method]}</td>
                    <td>{r.direction.replace("_", " ")}</td>
                    <td>{r.missingPercentage.toFixed(1)}%</td>
                    <td>{r.uniqueValues}</td>
                    <td>
                        <span className={`action-badge ${r.suggestedAction}`}>
                          {labels[r.suggestedAction]}
                        </span>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
            {detail && (
              <aside className="correlation-detail">
                <span className="eyebrow">FIELD DETAIL</span>
                <h3>{detail.fieldName}</h3>
                <div className="detail-score">
                  <b>{detail.normalizedScore?.toFixed(2) ?? "—"}</b>
                  <span>{detail.strength.replace("_", " ")}</span>
                </div>
                <h4>{methodLabels[detail.method]}</h4>
                <p>{explanations[detail.method]}</p>
                {detail.details &&
                  Object.entries(detail.details)
                    .filter(([, v]) => v !== undefined)
                    .map(([key, value]) => (
                      <div className="detail-line" key={key}>
                        <b>
                          {key
                            .replaceAll(/([A-Z])/g, " $1")
                            .replaceAll("_", " ")}
                        </b>
                        <span>{pretty(value)}</span>
                      </div>
                    ))}
                {detail.missingPercentage > 50 && (
                  <div className="detail-warning">
                    More than half of this field is missing.
                  </div>
                )}
                {detail.warnings.map((w) => (
                  <div className="detail-warning" key={w}>
                    {w} This field may reveal the answer directly and make
                    validation look unrealistically good.
                  </div>
                ))}
              </aside>
            )}
          </div>
          <div className="correlation-notes">
            <p>
              <b>Weak signal does not always mean useless.</b> Some fields only
              become useful in combination with others.
            </p>
            {leakage > 0 && (
              <p className="leakage-note">
                <b>Be careful:</b> leakage fields can make a model look accurate
                during testing but fail in real use.
              </p>
            )}
          </div>
          <div className="actions">
            <button className="btn primary" onClick={onUseRecommended}>
              Use recommended fields
            </button>
            <button className="btn ghost" onClick={onContinue}>
              Continue to feature selection →
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
