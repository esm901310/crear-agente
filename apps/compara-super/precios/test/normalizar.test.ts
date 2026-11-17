import { describe, expect, it } from 'vitest';
import {
  armarPrecios,
  completarGtin,
  interpretarPresentacion,
  marcaEnMayusculas,
  normalizarTexto,
} from '../src/normalizar';

describe('normalizar', () => {
  it('interpreta presentaciones comunes', () => {
    expect(interpretarPresentacion('Arroz Progreso Blanco 1.75 Kg')).toEqual({ cantidad: 1750, unidad: 'g', texto: '1.75 kg' });
    expect(interpretarPresentacion('Arroz Mr. Dieck Escaldado 1750 Gr')?.cantidad).toBe(1750);
    expect(interpretarPresentacion('PROGRESO Arroz BlancoGranoLar1.75Kg')?.cantidad).toBe(1750);
    expect(interpretarPresentacion('Aceite Clover 946 ml')).toEqual({ cantidad: 946, unidad: 'ml', texto: '946 ml' });
    expect(interpretarPresentacion('Aceite 1 Litro')?.cantidad).toBe(1000);
    expect(interpretarPresentacion('Frijol rojo 3.3 LBS')?.unidad).toBe('g');
    expect(interpretarPresentacion('Leche Sula 1/2 galon')).toEqual({ cantidad: 1892.71, unidad: 'ml', texto: '0.5 gal' });
    expect(interpretarPresentacion('Arroz para sushi libra')).toBeUndefined();
  });

  it('saca la marca en mayúsculas del inicio', () => {
    expect(marcaEnMayusculas('PROGRESO Arroz Blanco')).toBe('Progreso');
    expect(marcaEnMayusculas('MR DIECK Arroz Escaldado')).toBe('Mr Dieck');
    expect(marcaEnMayusculas('Arroz Blanco')).toBeUndefined();
  });

  it('calcula el dígito verificador (Los Andes guarda el UPC sin él)', () => {
    expect(completarGtin('70751700208')).toBe('707517002083');
    expect(completarGtin('2099')).toBeUndefined();
  });

  it('arma precios con y sin oferta', () => {
    expect(armarPrecios(80.9, 80.9)).toEqual({ precio: 80.9 });
    expect(armarPrecios(48.75, 39)).toEqual({ precio: 48.75, precioOferta: 39 });
    expect(armarPrecios(undefined, undefined)).toBeUndefined();
  });

  it('normaliza texto para comparar', () => {
    expect(normalizarTexto('  Frijoles  ROJOS, Señorial ')).toBe('frijoles rojos senorial');
  });
});
