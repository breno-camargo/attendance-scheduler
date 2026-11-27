const scheduleYears = Array.from({ length: 81 }, (_, offset) => 2020 + offset);

interface ScheduleYearSelectProps {
  year: number;
  onChange: (year: number) => void;
}

export default function ScheduleYearSelect({ year, onChange }: ScheduleYearSelectProps) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      Ano da agenda
      <select
        className="form-input"
        style={{ width: 'auto' }}
        value={year}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {scheduleYears.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
