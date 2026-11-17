import { describe, expect, it } from 'vitest';
import {
  armarPrecios,
  completarGtin,
  interpretarPresentacion,
  marcaEnMayusculas,
  nombreParaMostrar,
  normalizarTexto,
  separarPalabras,
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

describe('nombreParaMostrar', () => {
  it('limpia el título de Colonial: separa palabras, marca en Título y quita la presentación', () => {
    expect(
      nombreParaMostrar('PROGRESO Arroz BlancoGranoLar1.75Kg', { marca: 'Progreso', presentacion: '1.75 kg' }),
    ).toBe('Progreso Arroz Blanco Grano Lar');
  });

  it('sin presentación conocida la deja (separada) en el nombre', () => {
    expect(nombreParaMostrar('PROGRESO Arroz BlancoGranoLar1.75Kg')).toBe('Progreso Arroz Blanco Grano Lar 1.75 Kg');
  });

  it('solo quita la presentación si coincide con la indicada', () => {
    expect(nombreParaMostrar('MANHATTAN Arroz Blanco 3.3 LBS', { presentacion: '3.3 lb' })).toBe('Manhattan Arroz Blanco');
    expect(nombreParaMostrar('MANHATTAN Arroz Blanco 3.3 LBS', { presentacion: '5 lb' })).toBe(
      'Manhattan Arroz Blanco 3.3 LBS',
    );
    expect(nombreParaMostrar('Arroz Mr. Dieck Escaldado 1750 Gr', { marca: 'Mr Dieck', presentacion: '1750 g' })).toBe(
      'Arroz Mr. Dieck Escaldado',
    );
    expect(nombreParaMostrar('VIGO Basmati Arroz Blanco 908 g', { presentacion: '908 g' })).toBe('Vigo Basmati Arroz Blanco');
  });

  it('no cambia nombres que ya están bien (salvo quitar la presentación)', () => {
    expect(nombreParaMostrar('Arroz Tia Emely Blanco 1.75 Kg', { marca: 'Tia Emely', presentacion: '1.75 kg' })).toBe(
      'Arroz Tia Emely Blanco',
    );
    expect(nombreParaMostrar('Salsa McCormick Picante')).toBe('Salsa McCormick Picante');
  });

  it('marca de varias palabras y nombre entero en mayúsculas', () => {
    expect(nombreParaMostrar('DOS PINOS Leche Entera 946ml', { marca: 'Dos Pinos', presentacion: '946 ml' })).toBe(
      'Dos Pinos Leche Entera',
    );
    expect(nombreParaMostrar('ARROZ BLANCO SULA 2 LB', { presentacion: '2 lb' })).toBe('Arroz Blanco Sula');
  });

  it('limpia conectores que quedan colgando y nunca deja el nombre vacío', () => {
    expect(nombreParaMostrar('Frijoles Rojos - 400 g', { presentacion: '400 g' })).toBe('Frijoles Rojos');
    expect(nombreParaMostrar('Azúcar de 2 kg', { presentacion: '2 kg' })).toBe('Azúcar');
    expect(nombreParaMostrar('1 Kg', { presentacion: '1 kg' })).toBe('1 Kg');
  });
});

describe('separarPalabras', () => {
  it('separa por mayúscula y por número', () => {
    expect(separarPalabras('BlancoGranoLar1.75Kg')).toBe('Blanco Grano Lar 1.75 Kg');
    expect(separarPalabras('Leche 946ml')).toBe('Leche 946 ml');
    expect(separarPalabras('McCormick 7UP')).toBe('McCormick 7UP');
  });
});
