// Logo.jsx
export default function Logo({ style }) {
  return (
    <div
      style={{
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontSize: '0.78rem',
        fontWeight: 500,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: '#ffffff',
        lineHeight: 1,
        userSelect: 'none',
        paddingRight: '0.3em',
        ...style,
      }}
    >
      Nexus<span style={{ color: '#c8a961' }}>.</span>
    </div>
  );
}
